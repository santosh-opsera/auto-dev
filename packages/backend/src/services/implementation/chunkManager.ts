import { randomUUID } from 'node:crypto';
import {
  canTransitionChunkStatus,
  type ChunkDecomposeRequest,
  type ChunkListResponse,
  type ChunkStatus,
  type ChunkStatusUpdateRequest,
  type ImplementationChunkResponse,
  type PrdCodebaseContextSummary,
  type PrdSections,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  getImplementationChunkModel,
  type ImplementationChunkRecord,
} from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { withRetry } from '../../lib/retry.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '../events/eventBus.js';
import { llmAdapter } from '../llm/llmAdapter.js';
import { dependenciesSatisfied, orderChunksByDependencies } from './chunkOrdering.js';
import { parseChunkLlmOutput } from './chunkParser.js';
import { CHUNK_SYSTEM_PROMPT, buildChunkUserPrompt } from './chunkPromptBuilder.js';

function toIso(date: Date): string {
  return date.toISOString();
}

function mapChunk(doc: ImplementationChunkRecord): ImplementationChunkResponse {
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
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}

function toProgressStatus(
  status: ChunkStatus,
): 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused' | 'skipped' {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'PAUSED':
      return 'paused';
    case 'SKIPPED':
      return 'skipped';
  }
}

function progressPercentFor(status: ChunkStatus): number {
  switch (status) {
    case 'PENDING':
      return 0;
    case 'IN_PROGRESS':
    case 'PAUSED':
      return 50;
    case 'COMPLETED':
    case 'SKIPPED':
      return 100;
    case 'FAILED':
      return 0;
  }
}

export class ChunkManager {
  constructor(
    private readonly llm = llmAdapter,
    private readonly retryDelaysMs: readonly number[] = process.env.NODE_ENV === 'test'
      ? [0, 0]
      : [500, 1500],
  ) {}

  async decompose(
    user: UserDocument,
    workflowDocumentId: string,
    input: ChunkDecomposeRequest,
  ): Promise<ChunkListResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const prd = await getPrdModel().findById(input.prdId).exec();

    if (!prd || prd.userId !== String(user._id)) {
      throw new AppError(
        'PrdNotFound',
        'PRD was not found.',
        404,
        'Provide a valid prdId belonging to the signed-in user.',
      );
    }

    if (prd.status !== 'approved') {
      throw new AppError(
        'PrdNotApproved',
        'Only approved PRDs can be decomposed into implementation chunks.',
        409,
        'Approve the PRD before requesting chunk decomposition.',
      );
    }

    const draft = await this.generateDraft({
      id: prd._id.toString(),
      ticketKey: prd.ticketKey,
      sections: prd.sections,
      codebaseContext: prd.codebaseContext,
    });

    const ordered = orderChunksByDependencies(draft.chunks);

    await getImplementationChunkModel()
      .deleteMany({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
      })
      .exec();

    const tempIdToMongoId = new Map<string, string>();
    const created: ImplementationChunkRecord[] = [];

    for (let order = 0; order < ordered.length; order += 1) {
      const node = ordered[order]!;
      const dependencyIds = node.dependsOn.map((tempId) => {
        const mapped = tempIdToMongoId.get(tempId);
        if (!mapped) {
          throw new AppError(
            'ChunkDependencyError',
            `Failed to resolve dependency "${tempId}" for chunk "${node.tempId}".`,
            500,
            'Retry chunk decomposition.',
          );
        }
        return mapped;
      });

      const record = await getImplementationChunkModel().create({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
        workflowId: workflow.workflowId,
        prdId: prd._id.toString(),
        order,
        name: node.name,
        description: node.description,
        scope: node.scope,
        dependencies: dependencyIds,
        estimatedComplexity: node.estimatedComplexity,
        status: 'PENDING',
        createdBy: String(user._id),
        updatedBy: String(user._id),
        dataClassification: 'internal',
      });

      tempIdToMongoId.set(node.tempId, record._id.toString());
      created.push(record);

      await eventBus.publish(
        {
          type: 'CHUNK_CREATED',
          payload: {
            workflowId: workflow.workflowId,
            chunkId: record._id.toString(),
            prdId: prd._id.toString(),
            name: record.name,
            order: record.order,
            status: record.status,
          },
          metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
        },
        { awaitHandlers: true },
      );
    }

    await auditService.logSafe({
      resource: `workflows/${workflow._id.toString()}/chunks`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        prdId: prd._id.toString(),
        chunkCount: created.length,
        chunkIds: created.map((chunk) => chunk._id.toString()),
        correlationHint: randomUUID(),
      },
    });

    return { chunks: created.map(mapChunk) };
  }

  async listForWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<ChunkListResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const records = await getImplementationChunkModel()
      .find({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
      })
      .sort({ order: 1 })
      .exec();

    return { chunks: records.map(mapChunk) };
  }

  async updateStatus(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: ChunkStatusUpdateRequest,
  ): Promise<ImplementationChunkResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const record = await getImplementationChunkModel().findById(chunkId).exec();

    if (
      !record ||
      record.userId !== String(user._id) ||
      record.workflowDocumentId !== workflow._id.toString()
    ) {
      throw new AppError(
        'ChunkNotFound',
        'Implementation chunk was not found for this workflow.',
        404,
        'Use a valid chunkId belonging to the workflow.',
      );
    }

    if (record.status === input.status) {
      return mapChunk(record);
    }

    if (!canTransitionChunkStatus(record.status, input.status)) {
      throw new AppError(
        'InvalidChunkStatusTransition',
        `Cannot transition chunk from ${record.status} to ${input.status}.`,
        409,
        'Use an allowed status transition for this chunk.',
      );
    }

    if (input.status === 'IN_PROGRESS' && record.dependencies.length > 0) {
      const dependencyRecords = await getImplementationChunkModel()
        .find({
          _id: { $in: record.dependencies },
          userId: String(user._id),
          workflowDocumentId: workflow._id.toString(),
        })
        .exec();

      const completedIds = new Set(
        dependencyRecords
          .filter((dep) => dep.status === 'COMPLETED')
          .map((dep) => dep._id.toString()),
      );

      if (!dependenciesSatisfied(record.dependencies, completedIds)) {
        throw new AppError(
          'ChunkDependenciesIncomplete',
          'Cannot start a chunk before all dependency chunks are COMPLETED.',
          409,
          'Complete dependency chunks first, or skip them intentionally before proceeding.',
        );
      }
    }

    const previousStatus = record.status;
    record.status = input.status;
    record.updatedBy = String(user._id);
    await record.save();

    await eventBus.publish(
      {
        type: 'CHUNK_PROGRESS',
        payload: {
          workflowId: workflow.workflowId,
          chunkId: record._id.toString(),
          status: toProgressStatus(record.status),
          progressPercent: progressPercentFor(record.status),
        },
        metadata: this.buildMetadata(user, workflow.ticketKey, workflow.workflowId),
      },
      { awaitHandlers: true },
    );

    await auditService.logSafe({
      resource: `workflows/${workflow._id.toString()}/chunks/${record._id.toString()}`,
      operation: 'update',
      actor: String(user._id),
      previousValue: { status: previousStatus },
      newValue: { status: record.status, correlationHint: randomUUID() },
    });

    return mapChunk(record);
  }

  private async generateDraft(prd: {
    id: string;
    ticketKey: string;
    sections: PrdSections;
    codebaseContext: PrdCodebaseContextSummary;
  }) {
    try {
      return await withRetry(async () => {
        const completion = await this.llm.chat(
          [
            { role: 'system', content: CHUNK_SYSTEM_PROMPT },
            { role: 'user', content: buildChunkUserPrompt({ prd }) },
          ],
          {
            temperature: 0.2,
            maxTokens: 2048,
            cache: false,
          },
        );
        return parseChunkLlmOutput(completion.content);
      }, this.retryDelaysMs);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      throw new AppError(
        'ChunkDecompositionFailed',
        error instanceof Error
          ? error.message
          : 'Chunk decomposition failed due to an LLM error.',
        503,
        'Retry chunk decomposition. If the failure persists, verify LLM provider configuration.',
      );
    }
  }

  private async loadOwnedWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<WorkflowRecord> {
    const record = await getWorkflowModel().findById(workflowDocumentId).exec();
    if (!record || record.userId !== String(user._id)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Use a valid workflow id for the signed-in user.',
      );
    }
    return record;
  }

  private buildMetadata(user: UserDocument, ticketKey: string, workflowId: string) {
    return {
      eventId: randomUUID(),
      correlationId: `ticket-${ticketKey}:${workflowId}`,
      actor: String(user._id),
      userId: String(user._id),
      timestamp: new Date().toISOString(),
    };
  }
}

export const chunkManager = new ChunkManager();
