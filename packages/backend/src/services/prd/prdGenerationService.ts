import { randomUUID } from 'node:crypto';
import {
  PRD_GENERATION_TIMEOUT_MS,
  encodePrdSections,
  type CodebaseContext,
  type PrdCodebaseContextSummary,
  type PrdCreateVersionRequest,
  type PrdGenerateRequest,
  type PrdListResponse,
  type PrdResponse,
  type PrdSections,
  type TicketIntent,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getApprovalRequestModel } from '../../models/approvalRequestModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getPrdModel, type PrdRecord } from '../../models/prdModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { withRetry } from '@autodev/infrastructure';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { llmAdapter } from '../llm/llmAdapter.js';
import { parsePrdLlmOutput } from './prdParser.js';
import { PRD_SYSTEM_PROMPT, buildPrdUserPrompt } from './prdPromptBuilder.js';

function toIso(date: Date): string {
  return date.toISOString();
}

function mapPrd(doc: PrdRecord): PrdResponse {
  const response: PrdResponse = {
    id: doc._id.toString(),
    ticketKey: doc.ticketKey,
    ticketIntentId: doc.ticketIntentId,
    version: doc.version,
    status: doc.status,
    isActive: doc.isActive,
    sections: doc.sections,
    codebaseContext: doc.codebaseContext,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };

  if (doc.approvalRequestId) {
    response.approvalRequestId = doc.approvalRequestId;
  }
  if (doc.workflowId) {
    response.workflowId = doc.workflowId;
  }
  if (doc.owner) {
    response.owner = doc.owner;
  }
  if (doc.repo) {
    response.repo = doc.repo;
  }
  if (doc.previousVersionId) {
    response.previousVersionId = doc.previousVersionId;
  }
  if (doc.approvedBy) {
    response.approvedBy = doc.approvedBy;
  }
  if (doc.approvedAt) {
    response.approvedAt = toIso(doc.approvedAt);
  }
  if (doc.rejectedBy) {
    response.rejectedBy = doc.rejectedBy;
  }
  if (doc.rejectedAt) {
    response.rejectedAt = toIso(doc.rejectedAt);
  }
  if (doc.rejectionReason) {
    response.rejectionReason = doc.rejectionReason;
  }

  return response;
}

function mapTicketIntent(record: {
  ticketKey: string;
  problemStatement: string;
  proposedApproach: string;
  acceptanceCriteria: string[];
  affectedComponents: string[];
  dependencies: string[];
  constraints: string[];
  metadata: TicketIntent['metadata'];
}): TicketIntent {
  return {
    ticketKey: record.ticketKey,
    problemStatement: record.problemStatement,
    proposedApproach: record.proposedApproach,
    acceptanceCriteria: record.acceptanceCriteria,
    affectedComponents: record.affectedComponents,
    dependencies: record.dependencies,
    constraints: record.constraints,
    metadata: record.metadata,
  };
}

export function buildCodebaseContextSummary(
  ticketIntent: TicketIntent,
  codebaseContext?: CodebaseContext,
): PrdCodebaseContextSummary {
  const affectedModules = [
    ...new Set([
      ...ticketIntent.affectedComponents,
      ...(codebaseContext?.architecturalLayers.map((layer) => layer.layer) ?? []),
    ]),
  ];

  const applicablePatterns =
    codebaseContext?.designPatterns
      .filter((pattern) => pattern.confidence >= 0.5)
      .map((pattern) => pattern.pattern) ?? [];

  const integrationPoints = [
    ...new Set([
      ...(codebaseContext?.architecturalLayers.flatMap((layer) => layer.paths) ?? []),
      ...(codebaseContext?.dependencyGraph.slice(0, 20).map((edge) => `${edge.from} -> ${edge.to}`) ??
        []),
    ]),
  ];

  return {
    affectedModules,
    applicablePatterns,
    integrationPoints,
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => {
          reject(
            new AppError(
              'PrdGenerationTimeout',
              `PRD generation exceeded the ${timeoutMs}ms time budget.`,
              504,
              'Retry PRD generation. If timeouts persist, reduce context size or check LLM provider health.',
            ),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export class PrdGenerationService {
  constructor(
    private readonly llm = llmAdapter,
    private readonly timeoutMs = PRD_GENERATION_TIMEOUT_MS,
    private readonly retryDelaysMs: readonly number[] = process.env.NODE_ENV === 'test'
      ? [0, 0]
      : [500, 1500],
  ) {}

  async generate(
    user: UserDocument,
    ticketKey: string,
    input: PrdGenerateRequest,
  ): Promise<PrdResponse> {
    const ticketIntentRecord = await getTicketIntentModel()
      .findOne({ userId: String(user._id), ticketKey })
      .sort({ createdAt: -1 })
      .exec();

    if (!ticketIntentRecord) {
      throw new AppError(
        'TicketIntentNotFound',
        'Ticket intent has not been parsed yet.',
        412,
        'Parse the ticket before generating a PRD.',
      );
    }

    let codebaseContext: CodebaseContext | undefined;
    if (input.owner && input.repo) {
      const codebaseContextRecord = await getCodebaseContextModel()
        .findOne({ userId: String(user._id), owner: input.owner, repo: input.repo })
        .sort({ updatedAt: -1 })
        .exec();

      if (!codebaseContextRecord) {
        throw new AppError(
          'CodebaseContextNotFound',
          'Codebase analysis has not been run for this repository.',
          412,
          'Analyze the repository before generating a PRD with owner/repo context.',
        );
      }
      codebaseContext = codebaseContextRecord.context;
    }

    if (input.approvalRequestId) {
      const approval = await getApprovalRequestModel().findById(input.approvalRequestId).exec();
      if (!approval || approval.userId !== String(user._id) || approval.ticketKey !== ticketKey) {
        throw new AppError(
          'ApprovalRequestNotFound',
          'Approval request was not found for this ticket.',
          404,
          'Provide a valid approvalRequestId belonging to this ticket, or omit it.',
        );
      }
    }

    const ticketIntent = mapTicketIntent(ticketIntentRecord);
    const codebaseSummary = buildCodebaseContextSummary(ticketIntent, codebaseContext);
    const sections = await this.generateSections(ticketIntent, codebaseContext, codebaseSummary);
    const encodedSections = encodePrdSections(sections);

    return this.persistNewVersion(user, {
      ticketKey,
      ticketIntentId: ticketIntentRecord._id.toString(),
      approvalRequestId: input.approvalRequestId,
      workflowId: input.workflowId,
      owner: input.owner,
      repo: input.repo,
      sections: encodedSections,
      codebaseContext: codebaseSummary,
      status: 'draft',
    });
  }

  async getById(user: UserDocument, id: string): Promise<PrdResponse> {
    const record = await this.loadOwnedPrd(user, id);
    return mapPrd(record);
  }

  async getLatestForTicket(user: UserDocument, ticketKey: string): Promise<PrdResponse> {
    const record = await getPrdModel()
      .findOne({ userId: String(user._id), ticketKey, isActive: true })
      .sort({ version: -1 })
      .exec();

    if (!record) {
      throw new AppError(
        'PrdNotFound',
        'No PRD has been generated for this ticket yet.',
        404,
        'Generate a PRD before requesting the latest version.',
      );
    }

    return mapPrd(record);
  }

  async listForTicket(user: UserDocument, ticketKey: string): Promise<PrdListResponse> {
    const records = await getPrdModel()
      .find({ userId: String(user._id), ticketKey })
      .sort({ version: -1 })
      .exec();

    return { prds: records.map(mapPrd) };
  }

  async createVersion(
    user: UserDocument,
    id: string,
    input: PrdCreateVersionRequest,
  ): Promise<PrdResponse> {
    const previous = await this.loadOwnedPrd(user, id);
    const encodedSections = encodePrdSections(input.sections);

    return this.persistNewVersion(user, {
      ticketKey: previous.ticketKey,
      ticketIntentId: previous.ticketIntentId,
      approvalRequestId: previous.approvalRequestId,
      workflowId: previous.workflowId,
      owner: previous.owner,
      repo: previous.repo,
      sections: encodedSections,
      codebaseContext: previous.codebaseContext,
      status: input.status ?? 'draft',
      forcePrevious: previous,
    });
  }

  async approve(user: UserDocument, id: string): Promise<PrdResponse> {
    const record = await this.loadOwnedPrd(user, id);

    if (record.status === 'approved') {
      return mapPrd(record);
    }

    if (record.status === 'rejected') {
      throw new AppError(
        'PrdAlreadyRejected',
        'Rejected PRDs cannot be approved. Generate or edit a new version first.',
        409,
        'Create a new PRD version or regenerate from the ticket, then approve that version.',
      );
    }

    const previousStatus = record.status;
    const approvedAt = new Date();
    record.status = 'approved';
    record.approvedBy = user.displayName || user.email;
    record.approvedAt = approvedAt;
    record.rejectedBy = undefined;
    record.rejectedAt = undefined;
    record.rejectionReason = undefined;
    record.updatedBy = String(user._id);
    await record.save();

    await auditService.logSafe({
      resource: `prds/${record._id.toString()}`,
      operation: 'update',
      actor: String(user._id),
      previousValue: { status: previousStatus, version: record.version },
      newValue: {
        status: 'approved',
        action: 'approve',
        version: record.version,
        approvedBy: record.approvedBy,
        approvedAt: toIso(approvedAt),
        correlationHint: randomUUID(),
      },
    });

    return mapPrd(record);
  }

  async reject(user: UserDocument, id: string, reason: string): Promise<PrdResponse> {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      throw new AppError(
        'PrdRejectionReasonRequired',
        'A rejection reason is required.',
        400,
        'Provide a non-empty reason explaining why the PRD should be regenerated.',
      );
    }

    const record = await this.loadOwnedPrd(user, id);

    if (record.status === 'approved') {
      throw new AppError(
        'PrdAlreadyApproved',
        'Approved PRDs cannot be rejected.',
        409,
        'Create a new PRD version if scope needs to change after approval.',
      );
    }

    const previousStatus = record.status;
    const rejectedAt = new Date();
    record.status = 'rejected';
    record.rejectedBy = user.displayName || user.email;
    record.rejectedAt = rejectedAt;
    record.rejectionReason = trimmedReason;
    record.approvedBy = undefined;
    record.approvedAt = undefined;
    record.updatedBy = String(user._id);
    await record.save();

    await auditService.logSafe({
      resource: `prds/${record._id.toString()}`,
      operation: 'update',
      actor: String(user._id),
      previousValue: { status: previousStatus, version: record.version },
      newValue: {
        status: 'rejected',
        action: 'reject',
        version: record.version,
        rejectedBy: record.rejectedBy,
        rejectedAt: toIso(rejectedAt),
        rejectionReason: trimmedReason,
        markedForRegeneration: true,
        correlationHint: randomUUID(),
      },
    });

    return mapPrd(record);
  }

  private async generateSections(
    ticketIntent: TicketIntent,
    codebaseContext: CodebaseContext | undefined,
    codebaseSummary: PrdCodebaseContextSummary,
  ): Promise<PrdSections> {
    const userPrompt = buildPrdUserPrompt({
      ticketIntent,
      codebaseContext,
      affectedModules: codebaseSummary.affectedModules,
      applicablePatterns: codebaseSummary.applicablePatterns,
      integrationPoints: codebaseSummary.integrationPoints,
    });

    try {
      return await withTimeout(
        withRetry(async () => {
          const completion = await this.llm.chat(
            [
              { role: 'system', content: PRD_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
            {
              temperature: 0.2,
              maxTokens: 2048,
              cache: false,
            },
          );
          return parsePrdLlmOutput(completion.content);
        }, this.retryDelaysMs),
        this.timeoutMs,
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'PrdGenerationFailed',
        error instanceof Error ? error.message : 'PRD generation failed due to an LLM error.',
        503,
        'Retry PRD generation. If the failure persists, verify LLM provider configuration and circuit breaker state.',
      );
    }
  }

  private async persistNewVersion(
    user: UserDocument,
    input: {
      ticketKey: string;
      ticketIntentId: string;
      approvalRequestId?: string;
      workflowId?: string;
      owner?: string;
      repo?: string;
      sections: PrdSections;
      codebaseContext: PrdCodebaseContextSummary;
      status: PrdResponse['status'];
      forcePrevious?: PrdRecord;
    },
  ): Promise<PrdResponse> {
    const previous =
      input.forcePrevious ??
      (await getPrdModel()
        .findOne({ userId: String(user._id), ticketKey: input.ticketKey, isActive: true })
        .sort({ version: -1 })
        .exec());

    const version = previous ? previous.version + 1 : 1;
    const previousVersionId = previous ? previous._id.toString() : undefined;

    if (previous) {
      previous.isActive = false;
      previous.updatedBy = String(user._id);
      await previous.save();
    }

    const record = await getPrdModel().create({
      userId: String(user._id),
      ticketKey: input.ticketKey,
      ticketIntentId: input.ticketIntentId,
      approvalRequestId: input.approvalRequestId,
      workflowId: input.workflowId,
      owner: input.owner,
      repo: input.repo,
      version,
      previousVersionId,
      status: input.status,
      isActive: true,
      sections: input.sections,
      codebaseContext: input.codebaseContext,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      dataClassification: 'internal',
    });

    await auditService.logSafe({
      resource: `prds/${record._id.toString()}`,
      operation: 'create',
      actor: String(user._id),
      previousValue: previous
        ? { id: previous._id.toString(), version: previous.version }
        : undefined,
      newValue: {
        ticketKey: input.ticketKey,
        version,
        previousVersionId,
        status: input.status,
        correlationHint: randomUUID(),
      },
    });

    return mapPrd(record);
  }

  private async loadOwnedPrd(user: UserDocument, id: string): Promise<PrdRecord> {
    const record = await getPrdModel().findById(id).exec();
    if (!record || record.userId !== String(user._id)) {
      throw new AppError(
        'PrdNotFound',
        'PRD was not found.',
        404,
        'Use a valid PRD id for the signed-in user.',
      );
    }
    return record;
  }
}

export const prdGenerationService = new PrdGenerationService();
