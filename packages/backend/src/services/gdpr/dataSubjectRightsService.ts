import {
  ERASURE_GRACE_PERIOD_MS,
  cancelErasureResponseSchema,
  dataExportResponseSchema,
  erasureExecutionSummarySchema,
  erasureScheduleResponseSchema,
  updateUserProfileResponseSchema,
  type CancelErasureResponse,
  type DataExportResponse,
  type ErasureExecutionSummary,
  type ErasureScheduleResponse,
  type ScheduleErasureInput,
  type UpdateUserProfileInput,
  type UpdateUserProfileResponse,
  type UserProfileExport,
  type WorkflowResponse,
} from '@autodev/shared-types';
import {
  cryptographicallyErase,
  encryptWithPerRecordDek,
  ERASED_DEK_MARKER,
  systemClock,
  type Clock,
} from '@autodev/infrastructure';
import { getAiInteractionLogModel } from '../../models/aiInteractionLogModel.js';
import { getAuditLogModel } from '../../models/auditLogModel.js';
import { getConventionSettingsModel } from '../../models/conventionSettingsModel.js';
import {
  getDataErasureRequestModel,
  type DataErasureRequestRecord,
} from '../../models/dataErasureRequestModel.js';
import { getRepositoryConnectionModel } from '../../models/repositoryConnectionModel.js';
import { getSessionModel } from '../../models/sessionModel.js';
import {
  findUserByEmail,
  findUserById,
  getUserModel,
  type ProviderTokens,
  type UserRecord,
} from '../../models/userModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { getAvailableTransitions } from '../orchestration/workflowStateMachine.js';
import type { IntervalTimer } from '../integrations/types.js';
import { defaultIntervalTimer } from '../integrations/types.js';

export const ERASURE_JOB_INTERVAL_MS = 60 * 60 * 1000;

export type { Clock };

function toProfile(user: UserRecord): UserProfileExport {
  return {
    id: String(user._id),
    email: user.email,
    displayName: user.displayName,
    role: user.role,
    connectedProviders: [...user.connectedProviders],
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

function mapWorkflow(doc: WorkflowRecord): WorkflowResponse {
  const failedFrom = doc.error?.failedFrom ?? null;
  const response: WorkflowResponse = {
    id: String(doc._id),
    workflowId: doc.workflowId,
    ticketKey: doc.ticketKey,
    state: doc.state,
    history: doc.history.map((entry) => ({
      timestamp: entry.timestamp.toISOString(),
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
    error: doc.error
      ? {
          message: doc.error.message,
          ...(doc.error.code !== undefined ? { code: doc.error.code } : {}),
          ...(doc.error.failedFrom !== undefined ? { failedFrom: doc.error.failedFrom } : {}),
        }
      : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };

  if (doc.progress) {
    response.progress = {
      ...(doc.progress.percent !== undefined ? { percent: doc.progress.percent } : {}),
      ...(doc.progress.phase !== undefined ? { phase: doc.progress.phase } : {}),
      ...(doc.progress.chunkId !== undefined ? { chunkId: doc.progress.chunkId } : {}),
    };
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
      reviewers: doc.pullRequest.reviewers,
      labels: doc.pullRequest.labels,
      changeType: doc.pullRequest.changeType,
      headBranch: doc.pullRequest.headBranch,
      baseBranch: doc.pullRequest.baseBranch,
      owner: doc.pullRequest.owner,
      repo: doc.pullRequest.repo,
    };
  }

  return response;
}

/**
 * Cryptographically erase a Restricted secret: re-wrap under a throwaway DEK, then destroy the DEK.
 * Stored value is irrecoverable even if the environment KEK remains.
 */
export function cryptographicallyEraseSecret(value: string): string {
  const wrapped = encryptWithPerRecordDek(value);
  return JSON.stringify(cryptographicallyErase(wrapped));
}

function eraseProviderTokens(tokens: ProviderTokens | undefined): {
  tokens: ProviderTokens | undefined;
  erasedFields: number;
} {
  if (!tokens) {
    return { tokens: undefined, erasedFields: 0 };
  }

  let erasedFields = 0;
  const next: ProviderTokens = {
    ...tokens,
    encryptedAccessToken: cryptographicallyEraseSecret(tokens.encryptedAccessToken),
  };
  erasedFields += 1;

  if (tokens.encryptedRefreshToken) {
    next.encryptedRefreshToken = cryptographicallyEraseSecret(tokens.encryptedRefreshToken);
    erasedFields += 1;
  }

  return { tokens: next, erasedFields };
}

function toErasureScheduleResponse(record: DataErasureRequestRecord): ErasureScheduleResponse {
  return erasureScheduleResponseSchema.parse({
    requestId: String(record._id),
    status: record.status,
    requestedAt: record.requestedAt.toISOString(),
    scheduledFor: record.scheduledFor.toISOString(),
    gracePeriodMs: ERASURE_GRACE_PERIOD_MS,
    message:
      'Data erasure scheduled. You may cancel within the 24-hour grace period via POST /api/v1/user/data/cancel-erasure.',
  });
}

export interface DataSubjectRightsServiceOptions {
  clock?: Clock;
}

export class DataSubjectRightsService {
  private readonly clock: Clock;

  constructor(options: DataSubjectRightsServiceOptions = {}) {
    this.clock = options.clock ?? systemClock;
  }

  async exportUserData(user: UserRecord, actorId: string, ipAddress?: string): Promise<DataExportResponse> {
    const userId = String(user._id);
    const now = this.clock();

    const [conventions, workflows, auditPage, connections] = await Promise.all([
      getConventionSettingsModel().find({ userId }).sort({ version: -1 }).exec(),
      getWorkflowModel().find({ userId }).sort({ updatedAt: -1 }).exec(),
      auditService.query({ actor: userId }, 1, 100),
      getRepositoryConnectionModel().find({ userId }).sort({ connectedAt: -1 }).exec(),
    ]);

    const payload = dataExportResponseSchema.parse({
      exportedAt: now.toISOString(),
      profile: toProfile(user),
      conventionSettings: conventions.map((record) => ({
        id: String(record._id),
        userId: record.userId,
        version: record.version,
        isActive: record.isActive,
        previousVersionId: record.previousVersionId,
        commitMessageFormat: record.commitMessageFormat,
        branchNameTemplate: record.branchNameTemplate,
        branchNamingPattern: record.branchNamingPattern,
        prTitleTemplate: record.prTitleTemplate,
        prDescriptionTemplate: record.prDescriptionTemplate,
        reviewerAssignmentRules: record.reviewerAssignmentRules,
        createdAt: record.createdAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
      })),
      workflowHistory: workflows.map(mapWorkflow),
      auditLogs: auditPage.records,
      connectedRepositories: connections.map((conn) => ({
        id: String(conn._id),
        owner: conn.owner,
        repo: conn.repo,
        fullName: conn.fullName,
        defaultBranch: conn.defaultBranch,
        connectedAt: conn.connectedAt.toISOString(),
      })),
    });

    await auditService.logSafe({
      resource: `user/${userId}/data-export`,
      operation: 'create',
      actor: actorId,
      newValue: {
        exportedAt: payload.exportedAt,
        conventionCount: payload.conventionSettings.length,
        workflowCount: payload.workflowHistory.length,
        auditLogCount: payload.auditLogs.length,
        repositoryCount: payload.connectedRepositories.length,
      },
      ipAddress,
    });

    return payload;
  }

  async updateProfile(
    user: UserRecord,
    input: UpdateUserProfileInput,
    actorId: string,
    ipAddress?: string,
  ): Promise<UpdateUserProfileResponse> {
    const userId = String(user._id);
    const nextEmail = input.email.trim().toLowerCase();
    const nextDisplayName = input.displayName.trim();

    if (nextEmail !== user.email.toLowerCase()) {
      const existing = await findUserByEmail(nextEmail);
      if (existing && String(existing._id) !== userId) {
        throw new AppError(
          'Conflict',
          'Email address is already in use.',
          409,
          'Choose a different email address.',
        );
      }
    }

    const previousValue = {
      email: user.email,
      displayName: user.displayName,
    };

    user.email = nextEmail;
    user.displayName = nextDisplayName;
    user.updatedBy = actorId;
    await user.save();

    const profile = toProfile(user);

    await auditService.logSafe({
      resource: `user/${userId}/profile`,
      operation: 'update',
      actor: actorId,
      previousValue,
      newValue: { email: profile.email, displayName: profile.displayName },
      ipAddress,
    });

    return updateUserProfileResponseSchema.parse({ profile });
  }

  async scheduleErasure(
    user: UserRecord,
    input: ScheduleErasureInput,
    actorId: string,
    ipAddress?: string,
  ): Promise<ErasureScheduleResponse> {
    const userId = String(user._id);
    const confirmationEmail = input.confirmationEmail.trim().toLowerCase();

    if (confirmationEmail !== user.email.toLowerCase()) {
      throw new AppError(
        'ValidationError',
        'Confirmation email does not match the account email.',
        400,
        'Provide the exact email address associated with this account.',
      );
    }

    const existing = await getDataErasureRequestModel()
      .findOne({ userId, status: 'pending' })
      .exec();

    if (existing) {
      throw new AppError(
        'Conflict',
        'A data erasure request is already pending for this account.',
        409,
        'Cancel the existing request before scheduling a new one.',
      );
    }

    const requestedAt = this.clock();
    const scheduledFor = new Date(requestedAt.getTime() + ERASURE_GRACE_PERIOD_MS);

    const record = await getDataErasureRequestModel().create({
      userId,
      confirmationEmail,
      status: 'pending',
      requestedAt,
      scheduledFor,
      dataClassification: 'confidential',
      createdBy: actorId,
      updatedBy: actorId,
    });

    await auditService.logSafe({
      resource: `user/${userId}/data-erasure`,
      operation: 'delete',
      actor: actorId,
      newValue: {
        requestId: String(record._id),
        status: 'pending',
        scheduledFor: scheduledFor.toISOString(),
        gracePeriodMs: ERASURE_GRACE_PERIOD_MS,
      },
      ipAddress,
    });

    return toErasureScheduleResponse(record);
  }

  async cancelErasure(
    user: UserRecord,
    actorId: string,
    ipAddress?: string,
  ): Promise<CancelErasureResponse> {
    const userId = String(user._id);
    const now = this.clock();

    const pending = await getDataErasureRequestModel()
      .findOne({ userId, status: 'pending' })
      .exec();

    if (!pending) {
      throw new AppError(
        'NotFound',
        'No pending data erasure request found.',
        404,
        'Schedule an erasure request before attempting to cancel.',
      );
    }

    if (pending.scheduledFor.getTime() <= now.getTime()) {
      throw new AppError(
        'Conflict',
        'The grace period has ended; erasure can no longer be cancelled.',
        409,
        'Contact support if you believe this erasure was scheduled in error.',
      );
    }

    pending.status = 'cancelled';
    pending.cancelledAt = now;
    pending.updatedBy = actorId;
    await pending.save();

    await auditService.logSafe({
      resource: `user/${userId}/data-erasure`,
      operation: 'update',
      actor: actorId,
      previousValue: { status: 'pending', requestId: String(pending._id) },
      newValue: { status: 'cancelled', cancelledAt: now.toISOString() },
      ipAddress,
    });

    return cancelErasureResponseSchema.parse({
      requestId: String(pending._id),
      status: 'cancelled',
      cancelledAt: now.toISOString(),
      message: 'Scheduled data erasure has been cancelled.',
    });
  }

  /**
   * Execute full account erasure with cryptographic erasure of Restricted/Confidential secrets.
   * Audit of the impending erasure is written BEFORE any destructive operations.
   */
  async executeErasure(userId: string): Promise<ErasureExecutionSummary> {
    const user = await findUserById(userId);
    if (!user) {
      throw new AppError(
        'NotFound',
        'User not found for erasure.',
        404,
        'The erasure request may already have been executed.',
      );
    }

    const now = this.clock();

    // Log erasure BEFORE destroying data (AC-7).
    await auditService.log({
      resource: `user/${userId}/data-erasure`,
      operation: 'delete',
      actor: userId,
      previousValue: {
        email: user.email,
        displayName: user.displayName,
        connectedProviders: user.connectedProviders,
      },
      newValue: {
        status: 'executing',
        executedAt: now.toISOString(),
        method: 'cryptographic_erasure',
      },
    });

    let oauthTokenFields = 0;
    const githubErased = eraseProviderTokens(user.github);
    const atlassianErased = eraseProviderTokens(user.atlassian);
    oauthTokenFields += githubErased.erasedFields + atlassianErased.erasedFields;

    user.github = githubErased.tokens;
    user.atlassian = atlassianErased.tokens;
    user.connectedProviders = [];
    user.email = `${ERASED_DEK_MARKER}-${userId}@erased.invalid`;
    user.displayName = ERASED_DEK_MARKER;
    user.updatedBy = 'system';
    await user.save();

    const aiLogs = await getAiInteractionLogModel().find({ userId }).exec();
    let aiInteractionPayloads = 0;
    for (const log of aiLogs) {
      try {
        const parsed = JSON.parse(log.encryptedPayload) as {
          ciphertext?: string;
          wrappedDek?: string;
          erased?: boolean;
        };
        if (parsed.ciphertext && parsed.wrappedDek && !parsed.erased) {
          log.encryptedPayload = JSON.stringify(
            cryptographicallyErase({
              ciphertext: parsed.ciphertext,
              wrappedDek: parsed.wrappedDek,
              erased: false,
            }),
          );
        } else {
          log.encryptedPayload = cryptographicallyEraseSecret(log.encryptedPayload);
        }
      } catch {
        log.encryptedPayload = cryptographicallyEraseSecret(log.encryptedPayload);
      }
      await log.save();
      aiInteractionPayloads += 1;
    }

    const [
      sessions,
      conventionSettings,
      workflows,
      connectedRepositories,
      aiInteractionLogs,
    ] = await Promise.all([
      getSessionModel().deleteMany({ userId: user._id }),
      getConventionSettingsModel().deleteMany({ userId }),
      getWorkflowModel().deleteMany({ userId }),
      getRepositoryConnectionModel().deleteMany({ userId }),
      getAiInteractionLogModel().deleteMany({ userId }),
    ]);

    const auditDelete = await getAuditLogModel().collection.deleteMany({ actor: userId });

    const userDelete = await getUserModel().deleteOne({ _id: user._id });

    const summary = erasureExecutionSummarySchema.parse({
      userId,
      executedAt: now.toISOString(),
      cryptographicallyErased: {
        oauthTokenFields,
        aiInteractionPayloads,
      },
      purged: {
        sessions: sessions.deletedCount ?? 0,
        conventionSettings: conventionSettings.deletedCount ?? 0,
        workflows: workflows.deletedCount ?? 0,
        connectedRepositories: connectedRepositories.deletedCount ?? 0,
        aiInteractionLogs: aiInteractionLogs.deletedCount ?? 0,
        auditRecords: auditDelete.deletedCount ?? 0,
        userRecord: userDelete.deletedCount ?? 0,
      },
    });

    await getDataErasureRequestModel().updateMany(
      { userId, status: 'pending' },
      {
        $set: {
          status: 'executed',
          executedAt: now,
          executionSummary: summary,
          updatedBy: 'system',
        },
      },
    );

    // Durable proof of erasure (system actor survives user audit purge).
    await auditService.logSafe({
      resource: `user/${userId}/data-erasure`,
      operation: 'delete',
      actor: 'system',
      newValue: summary,
    });

    return summary;
  }

  async processDueErasureRequests(): Promise<ErasureExecutionSummary[]> {
    const now = this.clock();
    const due = await getDataErasureRequestModel()
      .find({ status: 'pending', scheduledFor: { $lte: now } })
      .exec();

    const results: ErasureExecutionSummary[] = [];
    for (const request of due) {
      const summary = await this.executeErasure(request.userId);
      results.push(summary);
    }
    return results;
  }
}

export const dataSubjectRightsService = new DataSubjectRightsService();

export interface ErasureJobHandle {
  stop(): void;
}

export interface StartErasureJobOptions {
  intervalMs?: number;
  clock?: Clock;
  timer?: IntervalTimer;
  service?: DataSubjectRightsService;
  runImmediately?: boolean;
}

/**
 * Periodically executes due GDPR erasure requests after the grace period.
 * Clock and timer are injectable for deterministic tests.
 */
export function startErasureProcessingJob(options: StartErasureJobOptions = {}): ErasureJobHandle {
  const intervalMs = options.intervalMs ?? ERASURE_JOB_INTERVAL_MS;
  const timer = options.timer ?? defaultIntervalTimer;
  const clock = options.clock ?? systemClock;
  const service = options.service ?? new DataSubjectRightsService({ clock });

  const execute = (): void => {
    void service.processDueErasureRequests().catch(() => {
      // Errors are logged inside audit/service paths; swallow to keep the job alive.
    });
  };

  if (options.runImmediately !== false) {
    execute();
  }

  const handle = timer.setInterval(execute, intervalMs);
  return {
    stop() {
      timer.clearInterval(handle);
    },
  };
}
