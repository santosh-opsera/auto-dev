import {
  RETENTION_POLICY_DAYS,
  type RetentionCategory,
  type RetentionPurgeResult,
  retentionPurgeResultSchema,
} from '@autodev/shared-types';
import { AUDIT_LOG_TTL_SECONDS, getAuditLogModel } from '../../models/auditLogModel.js';
import { getAiInteractionLogModel } from '../../models/aiInteractionLogModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { logger } from '../../utils/logger.js';
import type { IntervalTimer } from '../integrations/types.js';
import { defaultIntervalTimer } from '../integrations/types.js';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Default daily schedule: 24 hours. */
export const DAILY_RETENTION_INTERVAL_MS = DAY_MS;

export type Clock = () => Date;

export const systemClock: Clock = () => new Date();

export function retentionCutoff(category: RetentionCategory, now: Date): Date {
  const days = RETENTION_POLICY_DAYS[category];
  return new Date(now.getTime() - days * DAY_MS);
}

export interface RetentionPurgeStores {
  purgeRepoAnalysis(cutoff: Date): Promise<number>;
  purgeAiInteractionLogs(cutoff: Date): Promise<number>;
  /** Only purge audit events older than the 1-year minimum retention. */
  purgeExpiredAuditLogs(cutoff: Date): Promise<number>;
}

export async function defaultRetentionPurgeStores(clock: Clock = systemClock): Promise<RetentionPurgeStores> {
  return {
    async purgeRepoAnalysis(cutoff) {
      // Inactivity-based: purge analysis not updated since cutoff (and past expiresAt).
      const result = await getCodebaseContextModel().deleteMany({
        $or: [{ expiresAt: { $lte: cutoff } }, { updatedAt: { $lte: cutoff } }],
      });
      return result.deletedCount ?? 0;
    },
    async purgeAiInteractionLogs(cutoff) {
      const result = await getAiInteractionLogModel().deleteMany({
        $or: [{ expiresAt: { $lte: cutoff } }, { createdAt: { $lte: cutoff } }],
      });
      return result.deletedCount ?? 0;
    },
    async purgeExpiredAuditLogs(cutoff) {
      // Audit logs are append-only via Mongoose hooks; use collection deleteMany for TTL enforcement.
      // Minimum retention is 1 year — never purge newer than that relative to the job clock.
      const minAgeMs = AUDIT_LOG_TTL_SECONDS * 1000;
      const earliestAllowed = new Date(clock().getTime() - minAgeMs);
      const effectiveCutoff =
        cutoff.getTime() < earliestAllowed.getTime() ? cutoff : earliestAllowed;

      const result = await getAuditLogModel().collection.deleteMany({
        createdAt: { $lte: effectiveCutoff },
      });
      return result.deletedCount ?? 0;
    },
  };
}

export interface RunRetentionPurgeOptions {
  clock?: Clock;
  stores?: RetentionPurgeStores;
}

/**
 * Callable retention purge used by the daily job and tests.
 * Inject `clock` to control cutoff calculation without waiting.
 */
export async function runRetentionPurge(
  options: RunRetentionPurgeOptions = {},
): Promise<RetentionPurgeResult> {
  const clock = options.clock ?? systemClock;
  const now = clock();
  const stores = options.stores ?? (await defaultRetentionPurgeStores(clock));

  const analysisCutoff = retentionCutoff('repo_analysis', now);
  const aiCutoff = retentionCutoff('ai_interaction_logs', now);
  const auditCutoff = retentionCutoff('audit_logs', now);

  const purged = {
    repo_analysis: await stores.purgeRepoAnalysis(analysisCutoff),
    ai_interaction_logs: await stores.purgeAiInteractionLogs(aiCutoff),
    audit_logs: await stores.purgeExpiredAuditLogs(auditCutoff),
  };

  const result = retentionPurgeResultSchema.parse({
    ranAt: now.toISOString(),
    purged,
  });

  logger.info(
    `Retention purge completed: analysis=${purged.repo_analysis}, ai=${purged.ai_interaction_logs}, audit=${purged.audit_logs}`,
    { resource: 'retention-job', operation: 'purge' },
  );

  return result;
}

export interface DailyRetentionJobHandle {
  stop(): void;
}

export interface StartDailyRetentionJobOptions {
  intervalMs?: number;
  clock?: Clock;
  timer?: IntervalTimer;
  run?: (options: RunRetentionPurgeOptions) => Promise<RetentionPurgeResult>;
  /** When false, skip the immediate first run (tests often want this). */
  runImmediately?: boolean;
}

/**
 * Schedules {@link runRetentionPurge} on a daily interval.
 * Timer and clock are injectable for deterministic tests.
 */
export function startDailyRetentionJob(
  options: StartDailyRetentionJobOptions = {},
): DailyRetentionJobHandle {
  const intervalMs = options.intervalMs ?? DAILY_RETENTION_INTERVAL_MS;
  const timer = options.timer ?? defaultIntervalTimer;
  const run = options.run ?? runRetentionPurge;
  const clock = options.clock ?? systemClock;

  const execute = (): void => {
    void run({ clock }).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Retention purge failed';
      logger.error(message, { resource: 'retention-job', operation: 'purge' });
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
