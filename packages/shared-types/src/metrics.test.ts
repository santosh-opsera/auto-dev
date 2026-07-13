import { describe, expect, it } from 'vitest';
import {
  aggregatedMetricsResponseSchema,
  buildRateSummary,
  calculateAverageMs,
  calculateMedianMs,
  calculateRatePercent,
  metricsQuerySchema,
  periodWindow,
  resolveStageTimings,
  workflowMetricsResponseSchema,
} from './metrics.js';
import {
  expectedAggregatedMetrics30d,
  expectedWorkflowAMetrics,
} from './fixtures/metrics.js';

describe('metrics calculation helpers', () => {
  it('calculates rate percentages rounded to two decimals', () => {
    expect(calculateRatePercent(1, 2)).toBe(50);
    expect(calculateRatePercent(16, 18)).toBe(88.89);
    expect(calculateRatePercent(0, 0)).toBeNull();
    expect(buildRateSummary(3, 5)).toEqual({
      ratePercent: 60,
      numerator: 3,
      denominator: 5,
    });
  });

  it('calculates average and median durations', () => {
    expect(calculateAverageMs([])).toBeNull();
    expect(calculateMedianMs([])).toBeNull();
    expect(calculateAverageMs([1000, 3000, 8000])).toBe(4000);
    expect(calculateMedianMs([1000, 3000, 8000])).toBe(3000);
    expect(calculateMedianMs([1000, 3000, 5000, 8000])).toBe(4000);
  });

  it('builds stage timings from workflow transitions', () => {
    const timings = resolveStageTimings([
      {
        timestamp: '2026-07-01T10:00:00.000Z',
        previousState: 'CREATED',
        newState: 'TICKET_PARSED',
      },
      {
        timestamp: '2026-07-01T10:05:00.000Z',
        previousState: 'TICKET_PARSED',
        newState: 'ANALYZING',
      },
    ]);

    expect(timings).toEqual([
      {
        stage: 'CREATED',
        enteredAt: '2026-07-01T10:00:00.000Z',
        exitedAt: '2026-07-01T10:00:00.000Z',
        durationMs: 0,
      },
      {
        stage: 'TICKET_PARSED',
        enteredAt: '2026-07-01T10:00:00.000Z',
        exitedAt: '2026-07-01T10:05:00.000Z',
        durationMs: 300_000,
      },
      {
        stage: 'ANALYZING',
        enteredAt: '2026-07-01T10:05:00.000Z',
      },
    ]);
  });

  it('resolves period windows from an anchor date', () => {
    const { from, to } = periodWindow('7d', new Date('2026-07-13T12:00:00.000Z'));
    expect(to.toISOString()).toBe('2026-07-13T12:00:00.000Z');
    expect(from.toISOString()).toBe('2026-07-06T12:00:00.000Z');
  });

  it('defaults metrics query period to 30d', () => {
    expect(metricsQuerySchema.parse({})).toEqual({ period: '30d' });
    expect(metricsQuerySchema.safeParse({ period: '1d' }).success).toBe(false);
  });

  it('validates fixture expected responses', () => {
    expect(workflowMetricsResponseSchema.safeParse(expectedWorkflowAMetrics).success).toBe(true);
    expect(aggregatedMetricsResponseSchema.safeParse(expectedAggregatedMetrics30d).success).toBe(
      true,
    );
  });
});
