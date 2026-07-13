import { describe, expect, it } from 'vitest';
import {
  buildRateSummary,
  calculateAverageMs,
  calculateMedianMs,
  calculateRatePercent,
  resolveStageTimings,
} from '@autodev/shared-types';
import type { WorkflowMetricsDocument } from '../../models/workflowMetricsModel.js';
import { aggregateWorkflowMetrics } from './metricsCollectionService.js';

function baseDoc(
  overrides: Partial<WorkflowMetricsDocument> & Pick<WorkflowMetricsDocument, 'workflowId'>,
): WorkflowMetricsDocument {
  return {
    userId: 'user-1',
    reachedPrCreated: false,
    stageTimings: [],
    conventionValidations: [],
    testRuns: [],
    lastEventAt: new Date('2026-07-01T12:00:00.000Z'),
    createdAt: new Date('2026-07-01T10:00:00.000Z'),
    updatedAt: new Date('2026-07-01T12:00:00.000Z'),
    dataClassification: 'internal',
    ...overrides,
  };
}

describe('metricsCollectionService calculations', () => {
  it('computes adherence and first-pass test rates from stored counters', () => {
    expect(calculateRatePercent(3, 5)).toBe(60);
    expect(buildRateSummary(16, 18)).toEqual({
      ratePercent: 88.89,
      numerator: 16,
      denominator: 18,
    });
  });

  it('aggregates time-to-PR, completion, adherence, and test pass rates', () => {
    const docs: WorkflowMetricsDocument[] = [
      baseDoc({
        workflowId: 'a',
        startedAt: new Date('2026-07-01T10:00:00.000Z'),
        completedAt: new Date('2026-07-01T12:00:00.000Z'),
        reachedPrCreated: true,
        conventionValidations: [
          { artifactType: 'branch', passed: true, corrected: false, at: new Date() },
          { artifactType: 'commit', passed: true, corrected: false, at: new Date() },
          { artifactType: 'pr', passed: true, corrected: false, at: new Date() },
        ],
        testRuns: [
          {
            chunkId: 'c1',
            testCount: 10,
            firstIterationFailedCount: 0,
            firstIterationRecorded: true,
            at: new Date(),
          },
        ],
      }),
      baseDoc({
        workflowId: 'b',
        startedAt: new Date('2026-07-02T09:00:00.000Z'),
        reachedPrCreated: false,
        conventionValidations: [
          { artifactType: 'branch', passed: false, corrected: true, at: new Date() },
          { artifactType: 'branch', passed: true, corrected: true, at: new Date() },
        ],
        testRuns: [
          {
            chunkId: 'c2',
            testCount: 8,
            firstIterationFailedCount: 2,
            firstIterationRecorded: true,
            at: new Date(),
          },
        ],
      }),
    ];

    const aggregated = aggregateWorkflowMetrics(
      docs,
      '30d',
      new Date('2026-07-13T12:00:00.000Z'),
    );

    expect(aggregated.timeFromTicketToPr).toEqual({
      averageMs: 7_200_000,
      medianMs: 7_200_000,
      sampleCount: 1,
    });
    expect(aggregated.conventionAdherence).toEqual({
      ratePercent: 60,
      numerator: 3,
      denominator: 5,
    });
    expect(aggregated.aiGeneratedTestPassRate).toEqual({
      ratePercent: 88.89,
      numerator: 16,
      denominator: 18,
    });
    expect(aggregated.workflowCompletionRate).toEqual({
      ratePercent: 50,
      numerator: 1,
      denominator: 2,
    });
    expect(aggregated.totals).toEqual({
      workflowsStarted: 2,
      workflowsCompleted: 1,
    });
    expect(calculateAverageMs([7_200_000])).toBe(7_200_000);
    expect(calculateMedianMs([7_200_000])).toBe(7_200_000);
  });

  it('builds stage timing breakdown for multi-step transitions', () => {
    const timings = resolveStageTimings([
      {
        timestamp: '2026-07-01T10:00:00.000Z',
        previousState: 'CREATED',
        newState: 'TICKET_PARSED',
      },
      {
        timestamp: '2026-07-01T11:00:00.000Z',
        previousState: 'TICKET_PARSED',
        newState: 'PR_CREATED',
      },
    ]);

    expect(timings[1]).toMatchObject({
      stage: 'TICKET_PARSED',
      durationMs: 3_600_000,
    });
    expect(timings[2]).toMatchObject({
      stage: 'PR_CREATED',
      enteredAt: '2026-07-01T11:00:00.000Z',
    });
  });
});
