import { randomUUID } from 'node:crypto';
import {
  type WorkflowCreateRequest,
  type WorkflowError,
  type WorkflowFailRequest,
  type WorkflowListQuery,
  type WorkflowListResponse,
  type WorkflowProgress,
  type WorkflowResponse,
  type WorkflowState,
  type WorkflowTransitionRequest,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '../events/eventBus.js';
import {
  assertCanCancel,
  assertCanFail,
  assertCanPause,
  assertCanResume,
  assertCanRetry,
  assertValidHappyPathTransition,
  getAvailableTransitions,
} from './workflowStateMachine.js';

function toIso(date: Date): string {
  return date.toISOString();
}

function mapProgress(progress: WorkflowProgress | undefined): WorkflowProgress | undefined {
  if (!progress) {
    return undefined;
  }

  const mapped: WorkflowProgress = {};
  if (progress.percent !== undefined) {
    mapped.percent = progress.percent;
  }
  if (progress.phase !== undefined) {
    mapped.phase = progress.phase;
  }
  if (progress.chunkId !== undefined) {
    mapped.chunkId = progress.chunkId;
  }
  return mapped;
}

function mapError(error: WorkflowError | null | undefined): WorkflowError | null {
  if (!error) {
    return null;
  }

  const mapped: WorkflowError = {
    message: error.message,
  };
  if (error.code !== undefined) {
    mapped.code = error.code;
  }
  if (error.failedFrom !== undefined) {
    mapped.failedFrom = error.failedFrom;
  }
  return mapped;
}

function mapWorkflow(doc: WorkflowRecord): WorkflowResponse {
  const mappedError = mapError(doc.error);
  const failedFrom = mappedError?.failedFrom ?? null;
  const response: WorkflowResponse = {
    id: doc._id.toString(),
    workflowId: doc.workflowId,
    ticketKey: doc.ticketKey,
    state: doc.state,
    history: doc.history.map((entry) => ({
      timestamp: toIso(entry.timestamp),
      previousState: entry.previousState,
      newState: entry.newState,
      trigger: entry.trigger,
    })),
    availableTransitions: getAvailableTransitions(doc.state, {
      pausedFrom: doc.pausedFrom,
      failedFrom,
    }),
    pausedFrom: doc.pausedFrom ?? null,
    resumedFrom: doc.resumedFrom ?? null,
    error: mappedError,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };

  const progress = mapProgress(doc.progress);
  if (progress) {
    response.progress = progress;
  }

  if (doc.prUrl) {
    response.prUrl = doc.prUrl;
  }

  if (doc.pullRequest) {
    response.pullRequest = {
      url: doc.pullRequest.url,
      number: doc.pullRequest.number,
      title: doc.pullRequest.title,
      body: doc.pullRequest.body,
      reviewers: [...doc.pullRequest.reviewers],
      labels: [...doc.pullRequest.labels],
      changeType: doc.pullRequest.changeType,
      headBranch: doc.pullRequest.headBranch,
      baseBranch: doc.pullRequest.baseBranch,
      owner: doc.pullRequest.owner,
      repo: doc.pullRequest.repo,
    };
  }

  return response;
}

export class OrchestrationService {
  async createWorkflow(
    user: UserDocument,
    input: WorkflowCreateRequest,
  ): Promise<WorkflowResponse> {
    const workflowId = input.workflowId?.trim() || randomUUID();
    const existing = await getWorkflowModel()
      .findOne({ userId: String(user._id), workflowId })
      .exec();

    if (existing) {
      throw new AppError(
        'WorkflowAlreadyExists',
        'A workflow with this workflowId already exists.',
        409,
        'Use a unique workflowId or omit it to auto-generate one.',
      );
    }

    const record = await getWorkflowModel().create({
      userId: String(user._id),
      workflowId,
      ticketKey: input.ticketKey,
      state: 'CREATED',
      history: [],
      pausedFrom: null,
      resumedFrom: null,
      error: null,
      createdBy: String(user._id),
      updatedBy: String(user._id),
      dataClassification: 'confidential',
    });

    await auditService.logSafe({
      resource: `workflows/${record._id.toString()}`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        workflowId,
        ticketKey: input.ticketKey,
        state: 'CREATED',
      },
    });

    return mapWorkflow(record);
  }

  async listWorkflows(
    user: UserDocument,
    query: WorkflowListQuery = {},
  ): Promise<WorkflowListResponse> {
    const filter: Record<string, unknown> = { userId: String(user._id) };
    if (query.state) {
      filter.state = query.state;
    }

    const records = await getWorkflowModel()
      .find(filter)
      .sort({ updatedAt: -1 })
      .exec();

    return { workflows: records.map(mapWorkflow) };
  }

  async getWorkflow(user: UserDocument, id: string): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    return mapWorkflow(record);
  }

  async transition(
    user: UserDocument,
    id: string,
    input: WorkflowTransitionRequest,
  ): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    const trigger = input.trigger?.trim() || `transition.${input.toState.toLowerCase()}`;

    assertValidHappyPathTransition(record.state, input.toState);

    return this.applyTransition(user, record, input.toState, trigger);
  }

  async pause(
    user: UserDocument,
    id: string,
    progress?: WorkflowProgress,
  ): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    assertCanPause(record.state);

    if (progress) {
      record.progress = progress;
    }

    const pausedFrom = record.state;
    return this.applyTransition(user, record, 'PAUSED', 'user.pause', {
      pausedFrom,
    });
  }

  async resume(user: UserDocument, id: string): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    const target = assertCanResume(record.state, record.pausedFrom);

    return this.applyTransition(user, record, target, 'user.resume', {
      resumedFrom: 'PAUSED',
      clearPausedFrom: true,
    });
  }

  async cancel(user: UserDocument, id: string): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    assertCanCancel(record.state);
    return this.applyTransition(user, record, 'CANCELLED', 'user.cancel');
  }

  async fail(
    user: UserDocument,
    id: string,
    input: WorkflowFailRequest,
  ): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    assertCanFail(record.state);

    const error: WorkflowError = {
      message: input.error.message,
      failedFrom: record.state,
    };
    if (input.error.code) {
      error.code = input.error.code;
    }

    return this.applyTransition(user, record, 'FAILED', 'workflow.failed', { error });
  }

  async retry(user: UserDocument, id: string): Promise<WorkflowResponse> {
    const record = await this.loadOwnedWorkflow(user, id);
    const target = assertCanRetry(record.state, record.error?.failedFrom);

    return this.applyTransition(user, record, target, 'workflow.retry', {
      clearError: true,
    });
  }

  private async applyTransition(
    user: UserDocument,
    record: WorkflowRecord,
    toState: WorkflowState,
    trigger: string,
    options: {
      error?: WorkflowError | null;
      pausedFrom?: WorkflowState | null;
      resumedFrom?: WorkflowState | null;
      clearPausedFrom?: boolean;
      clearError?: boolean;
    } = {},
  ): Promise<WorkflowResponse> {
    const previousState = record.state;
    const now = new Date();

    record.history.push({
      timestamp: now,
      previousState,
      newState: toState,
      trigger,
    });
    record.state = toState;
    record.updatedBy = String(user._id);

    if (options.pausedFrom !== undefined) {
      record.pausedFrom = options.pausedFrom;
    }
    if (options.clearPausedFrom) {
      record.pausedFrom = null;
    }
    if (options.resumedFrom !== undefined) {
      record.resumedFrom = options.resumedFrom;
    }
    if (options.error !== undefined) {
      record.error = options.error;
    }
    if (options.clearError) {
      record.error = null;
    }

    await record.save();

    await eventBus.publish(
      {
        type: 'WORKFLOW_TRANSITIONED',
        payload: {
          workflowId: record.workflowId,
          previousState,
          newState: toState,
          trigger,
        },
        metadata: this.buildMetadata(user, record.ticketKey, record.workflowId),
      },
      { awaitHandlers: true },
    );

    if (toState === 'FAILED' && options.error) {
      await eventBus.publish(
        {
          type: 'WORKFLOW_FAILED',
          payload: {
            workflowId: record.workflowId,
            previousState,
            error: options.error,
          },
          metadata: this.buildMetadata(user, record.ticketKey, record.workflowId),
        },
        { awaitHandlers: true },
      );
    }

    await auditService.logSafe({
      resource: `workflows/${record._id.toString()}`,
      operation: 'update',
      actor: String(user._id),
      previousValue: { state: previousState },
      newValue: {
        state: toState,
        trigger,
        pausedFrom: record.pausedFrom ?? null,
        resumedFrom: record.resumedFrom ?? null,
        error: record.error ?? null,
      },
    });

    return mapWorkflow(record);
  }

  private async loadOwnedWorkflow(user: UserDocument, id: string): Promise<WorkflowRecord> {
    const record = await getWorkflowModel().findById(id).exec();

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

export const orchestrationService = new OrchestrationService();
