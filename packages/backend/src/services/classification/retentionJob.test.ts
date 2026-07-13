import { afterEach, describe, expect, it, vi } from 'vitest';
import { RETENTION_POLICY_DAYS } from '@autodev/shared-types';
import {
  createInMemoryRetentionStore,
  sampleClassificationDocuments,
} from '../../fixtures/dataClassification.js';
import {
  COLLECTION_DEFAULT_CLASSIFICATION,
  requiresCryptographicErasure,
  requiresFieldLevelEncryption,
  requiresRestrictedEncryption,
} from '../../database/baseSchema.js';
import { dataClassificationService } from './dataClassificationService.js';
import {
  DAILY_RETENTION_INTERVAL_MS,
  retentionCutoff,
  runRetentionPurge,
  startDailyRetentionJob,
} from './retentionJob.js';
import type { IntervalTimer } from '../integrations/types.js';

function createManualTimer(): IntervalTimer & { tick: () => void; cleared: boolean } {
  let callback: (() => void) | null = null;
  return {
    cleared: false,
    setInterval(cb) {
      callback = cb;
      return { id: 'manual' };
    },
    clearInterval() {
      this.cleared = true;
      callback = null;
    },
    tick() {
      callback?.();
    },
  };
}

describe('dataClassificationService', () => {
  it('documents collection defaults and tier enforcement flags', () => {
    expect(COLLECTION_DEFAULT_CLASSIFICATION.oauth_tokens).toBe('restricted');
    expect(COLLECTION_DEFAULT_CLASSIFICATION.users).toBe('confidential');
    expect(COLLECTION_DEFAULT_CLASSIFICATION.codebase_contexts).toBe('internal');
    expect(COLLECTION_DEFAULT_CLASSIFICATION.audit_events).toBe('confidential');

    expect(requiresRestrictedEncryption('restricted')).toBe(true);
    expect(requiresFieldLevelEncryption('confidential')).toBe(true);
    expect(requiresCryptographicErasure('confidential')).toBe(true);
    expect(requiresRestrictedEncryption('internal')).toBe(false);

    for (const doc of sampleClassificationDocuments) {
      expect(dataClassificationService.getHandling(doc.dataClassification).classification).toBe(
        doc.dataClassification,
      );
    }
  });

  it('calculates retention cutoffs for analysis 30d, AI 90d, audit 1y', () => {
    const now = new Date('2026-07-13T12:00:00.000Z');
    const analysis = retentionCutoff('repo_analysis', now);
    const ai = retentionCutoff('ai_interaction_logs', now);
    const audit = retentionCutoff('audit_logs', now);

    expect(analysis.toISOString()).toBe('2026-06-13T12:00:00.000Z');
    expect(ai.toISOString()).toBe('2026-04-14T12:00:00.000Z');
    expect(audit.toISOString()).toBe('2025-07-13T12:00:00.000Z');
    expect(RETENTION_POLICY_DAYS.audit_logs).toBe(365);
  });
});

describe('runRetentionPurge', () => {
  it('purges expired rows using an injectable clock and stores', async () => {
    const now = new Date('2026-07-13T00:00:00.000Z');
    const memory = createInMemoryRetentionStore({
      analysis: [
        {
          id: 'stale-analysis',
          updatedAt: new Date('2026-05-01T00:00:00.000Z'),
          expiresAt: new Date('2026-05-31T00:00:00.000Z'),
        },
        {
          id: 'fresh-analysis',
          updatedAt: new Date('2026-07-10T00:00:00.000Z'),
          expiresAt: new Date('2026-08-09T00:00:00.000Z'),
        },
      ],
      aiLogs: [
        {
          id: 'old-ai',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          expiresAt: new Date('2026-04-01T00:00:00.000Z'),
        },
        {
          id: 'new-ai',
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          expiresAt: new Date('2026-09-29T00:00:00.000Z'),
        },
      ],
      audit: [
        {
          id: 'old-audit',
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
        },
        {
          id: 'recent-audit',
          createdAt: new Date('2026-06-01T00:00:00.000Z'),
        },
      ],
    });

    const result = await runRetentionPurge({
      clock: () => now,
      stores: memory.stores,
    });

    expect(result.ranAt).toBe(now.toISOString());
    expect(result.purged.repo_analysis).toBe(1);
    expect(result.purged.ai_interaction_logs).toBe(1);
    expect(result.purged.audit_logs).toBe(1);
    expect(memory.analysis.map((row) => row.id)).toEqual(['fresh-analysis']);
    expect(memory.aiLogs.map((row) => row.id)).toEqual(['new-ai']);
    expect(memory.audit.map((row) => row.id)).toEqual(['recent-audit']);
  });
});

describe('startDailyRetentionJob', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs on an injectable timer interval without waiting a real day', async () => {
    const timer = createManualTimer();
    const runs: string[] = [];
    const clock = () => new Date('2026-07-13T00:00:00.000Z');

    const job = startDailyRetentionJob({
      intervalMs: DAILY_RETENTION_INTERVAL_MS,
      timer,
      clock,
      runImmediately: false,
      run: async ({ clock: c }) => {
        const ranAt = (c ?? clock)().toISOString();
        runs.push(ranAt);
        return {
          ranAt,
          purged: { repo_analysis: 0, ai_interaction_logs: 0, audit_logs: 0 },
        };
      },
    });

    expect(runs).toHaveLength(0);
    timer.tick();
    await Promise.resolve();
    expect(runs).toEqual(['2026-07-13T00:00:00.000Z']);

    job.stop();
    expect(timer.cleared).toBe(true);
  });
});
