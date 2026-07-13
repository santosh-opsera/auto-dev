import { randomUUID } from 'node:crypto';
import type {
  CodebaseContext,
  CursorContextDocument,
  CursorContextResponse,
  CursorExecuteRequest,
  CursorExecuteResponse,
  CursorImplementationResult,
  CursorResultsSubmitRequest,
  CursorResultsSubmitResponse,
  TicketIntent,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import {
  getImplementationChunkModel,
  type ImplementationChunkRecord,
} from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getTicketIntentModel } from '../../models/ticketIntentModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { conventionService } from '../conventions/conventionService.js';
import { packageCursorContext } from './contextPackager.js';
import {
  createCursorClient,
  type CursorBridgeClient,
} from './cursorClient.js';
import { validateCursorImplementationResult } from './resultValidator.js';

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
    acceptanceCriteria: [...record.acceptanceCriteria],
    affectedComponents: [...record.affectedComponents],
    dependencies: [...record.dependencies],
    constraints: [...record.constraints],
    metadata: {
      sourceSummary: record.metadata.sourceSummary,
      labels: [...record.metadata.labels],
      issueType: record.metadata.issueType,
      sprintContext: record.metadata.sprintContext,
      parsedAt: record.metadata.parsedAt,
    },
  };
}

function mapChunk(doc: ImplementationChunkRecord) {
  return {
    id: doc._id.toString(),
    workflowDocumentId: doc.workflowDocumentId,
    workflowId: doc.workflowId,
    prdId: doc.prdId,
    order: doc.order,
    name: doc.name,
    description: doc.description,
    scope: {
      files: [...doc.scope.files],
      modules: [...doc.scope.modules],
    },
    dependencies: [...doc.dependencies],
    estimatedComplexity: doc.estimatedComplexity,
    status: doc.status,
    branchName: doc.branchName,
    branchHeadSha: doc.branchHeadSha,
    lastCommitSha: doc.lastCommitSha,
    lastCommitMessage: doc.lastCommitMessage,
    gitStatus: doc.gitStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export class CursorBridgeService {
  constructor(private readonly client: CursorBridgeClient = createCursorClient()) {}

  async getContext(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
  ): Promise<CursorContextResponse> {
    const context = await this.buildContext(user, workflowDocumentId, chunkId);
    return { context };
  }

  async execute(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: CursorExecuteRequest = {},
  ): Promise<CursorExecuteResponse> {
    const dryRun = input.dryRun === true;
    const context = await this.buildContext(user, workflowDocumentId, chunkId);

    if (!dryRun && !this.client.isAvailable()) {
      throw new AppError(
        'CursorUnavailable',
        'Cursor IDE bridge is unavailable. CURSOR_BRIDGE_URL is not configured or the Cursor extension/MCP endpoint is unreachable.',
        503,
        'Set CURSOR_BRIDGE_URL to your Cursor bridge endpoint, ensure the Cursor IDE extension or MCP server is running and reachable, add its host to SSRF_ALLOWED_HOSTS if needed, then retry.',
      );
    }

    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/cursor/deliver`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        deliveryPhase: 'outbound',
        dryRun,
        chunkId: context.chunkId,
        workflowId: context.workflowId,
        filesToModify: context.guidance.filesToModify,
        correlationHint: randomUUID(),
      },
    });

    if (dryRun) {
      const delivery = {
        deliveryId: randomUUID(),
        status: 'dry_run' as const,
        deliveredAt: new Date().toISOString(),
      };

      await auditService.logSafe({
        resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/cursor/deliver`,
        operation: 'update',
        actor: String(user._id),
        newValue: {
          deliveryPhase: 'ack',
          deliveryId: delivery.deliveryId,
          status: delivery.status,
          hasResult: false,
          correlationHint: randomUUID(),
        },
      });

      return { context, delivery };
    }

    const { delivery, result: deliveredResult } = await this.client.deliver(context, { dryRun });

    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/cursor/deliver`,
      operation: 'update',
      actor: String(user._id),
      newValue: {
        deliveryPhase: 'ack',
        deliveryId: delivery.deliveryId,
        status: delivery.status,
        hasResult: Boolean(deliveredResult),
        correlationHint: randomUUID(),
      },
    });

    if (!dryRun) {
      const chunk = await getImplementationChunkModel().findById(chunkId).exec();
      if (chunk && chunk.status === 'PENDING') {
        chunk.status = 'IN_PROGRESS';
        chunk.updatedBy = String(user._id);
        await chunk.save();
      }
    }

    if (!deliveredResult) {
      return { context, delivery };
    }

    const validation = validateCursorImplementationResult({
      result: deliveredResult,
      expectedFiles: context.guidance.filesToModify,
      conventions: context.conventions,
      ticketKey: context.ticketIntent.ticketKey,
    });

    await this.auditResultReception(user, workflowDocumentId, chunkId, deliveredResult, validation);

    return {
      context,
      delivery,
      result: deliveredResult,
      validation,
    };
  }

  async submitResults(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: CursorResultsSubmitRequest,
  ): Promise<CursorResultsSubmitResponse> {
    const context = await this.buildContext(user, workflowDocumentId, chunkId);

    if (input.chunkId !== chunkId) {
      throw new AppError(
        'ChunkIdMismatch',
        'Result chunkId does not match the route chunkId.',
        400,
        'Submit results with the same chunkId as the URL path parameter.',
      );
    }

    if (input.workflowId !== context.workflowId) {
      throw new AppError(
        'WorkflowIdMismatch',
        'Result workflowId does not match the workflow for this chunk.',
        400,
        'Submit results with the workflowId from the packaged Cursor context.',
      );
    }

    const result: CursorImplementationResult = {
      ...input,
      receivedAt: new Date().toISOString(),
    };

    const validation = validateCursorImplementationResult({
      result,
      expectedFiles: context.guidance.filesToModify,
      conventions: context.conventions,
      ticketKey: context.ticketIntent.ticketKey,
    });

    await this.auditResultReception(user, workflowDocumentId, chunkId, result, validation);

    return { result, validation };
  }

  private async auditResultReception(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    result: CursorImplementationResult,
    validation: CursorExecuteResponse['validation'],
  ): Promise<void> {
    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/cursor/results`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        deliveryPhase: 'inbound',
        chunkId: result.chunkId,
        workflowId: result.workflowId,
        branchName: result.branchName,
        commitMessage: result.commitMessage,
        touchedFiles: validation?.scope.touchedFiles,
        unexpectedFiles: validation?.scope.unexpectedFiles,
        conventionValid: validation?.conventions.valid,
        scopeValid: validation?.scope.valid,
        correlationHint: randomUUID(),
      },
    });
  }

  private async buildContext(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
  ): Promise<CursorContextDocument> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const chunkRecord = await this.loadOwnedChunk(user, workflow, chunkId);
    const chunk = mapChunk(chunkRecord);

    const prd = await getPrdModel().findById(chunkRecord.prdId).exec();
    if (!prd || prd.userId !== String(user._id)) {
      throw new AppError(
        'PrdNotFound',
        'PRD linked to this chunk was not found.',
        404,
        'Re-decompose chunks from an approved PRD owned by the signed-in user.',
      );
    }

    if (prd.status !== 'approved') {
      throw new AppError(
        'PrdNotApproved',
        'Only approved PRDs can be packaged for Cursor IDE delivery.',
        409,
        'Approve the PRD before executing a chunk via the Cursor bridge.',
      );
    }

    const intentRecord = await getTicketIntentModel().findById(prd.ticketIntentId).exec();
    if (!intentRecord || intentRecord.userId !== String(user._id)) {
      throw new AppError(
        'TicketIntentNotFound',
        'TicketIntent linked to this PRD was not found.',
        404,
        'Re-parse the Jira ticket to recreate TicketIntent before Cursor delivery.',
      );
    }

    const conventions = await conventionService.getActive(String(user._id));
    if (!conventions) {
      throw new AppError(
        'ConventionsRequired',
        'Convention settings must be configured before Cursor IDE delivery.',
        409,
        'Create convention settings (branch naming and commit message format) before executing chunks.',
      );
    }

    const codebaseContext = await this.resolveCodebaseContext(user, prd.owner, prd.repo);

    return packageCursorContext({
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      ticketIntent: mapTicketIntent(intentRecord),
      codebaseContext,
      approvedPrd: {
        id: prd._id.toString(),
        ticketKey: prd.ticketKey,
        version: prd.version,
        status: 'approved',
        sections: prd.sections,
        approvedBy: prd.approvedBy,
        approvedAt: prd.approvedAt?.toISOString(),
      },
      chunk,
      conventions: {
        commitMessageFormat: conventions.commitMessageFormat,
        branchNamingPattern: conventions.branchNamingPattern,
        prTitleTemplate: conventions.prTitleTemplate,
        prDescriptionTemplate: conventions.prDescriptionTemplate,
        reviewerAssignmentRules: conventions.reviewerAssignmentRules,
      },
    });
  }

  private async resolveCodebaseContext(
    user: UserDocument,
    owner?: string,
    repo?: string,
  ): Promise<CodebaseContext> {
    if (owner && repo) {
      const record = await getCodebaseContextModel()
        .findOne({ userId: String(user._id), owner, repo })
        .exec();
      if (record) {
        return record.context;
      }
    }

    const latest = await getCodebaseContextModel()
      .findOne({ userId: String(user._id) })
      .sort({ updatedAt: -1 })
      .exec();

    if (!latest) {
      throw new AppError(
        'CodebaseContextNotFound',
        'CodebaseContext is required to package Cursor IDE context.',
        404,
        'Run codebase analysis for the repository linked to this PRD before executing chunks.',
      );
    }

    return latest.context;
  }

  private async loadOwnedWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<WorkflowRecord> {
    const workflow = await getWorkflowModel().findById(workflowDocumentId).exec();
    if (!workflow || workflow.userId !== String(user._id)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Provide a valid workflow id belonging to the signed-in user.',
      );
    }
    return workflow;
  }

  private async loadOwnedChunk(
    user: UserDocument,
    workflow: WorkflowRecord,
    chunkId: string,
  ): Promise<ImplementationChunkRecord> {
    const chunk = await getImplementationChunkModel().findById(chunkId).exec();
    if (
      !chunk ||
      chunk.userId !== String(user._id) ||
      chunk.workflowDocumentId !== workflow._id.toString()
    ) {
      throw new AppError(
        'ChunkNotFound',
        'Implementation chunk was not found for this workflow.',
        404,
        'Use a valid chunkId belonging to the workflow.',
      );
    }
    return chunk;
  }
}

export const cursorBridgeService = new CursorBridgeService();
