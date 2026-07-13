import { z } from 'zod';
import { workflowStateSchema } from './workflow.js';

export const METRICS_PERIODS = ['7d', '30d', '90d'] as const;

export const metricsPeriodSchema = z.enum(METRICS_PERIODS);
export type MetricsPeriod = z.infer<typeof metricsPeriodSchema>;

export const metricsPeriodDays: Record<MetricsPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

export const metricsQuerySchema = z.object({
  period: metricsPeriodSchema.default('30d'),
});

export type MetricsQuery = z.infer<typeof metricsQuerySchema>;

export const workflowMetricsParamsSchema = z.object({
  id: z.string().min(1),
});

export type WorkflowMetricsParams = z.infer<typeof workflowMetricsParamsSchema>;

export const CONVENTION_ARTIFACT_TYPES = ['branch', 'commit', 'pr'] as const;
export const conventionArtifactTypeSchema = z.enum(CONVENTION_ARTIFACT_TYPES);
export type ConventionArtifactType = z.infer<typeof conventionArtifactTypeSchema>;

export const rateSummarySchema = z.object({
  ratePercent: z.number().min(0).max(100).nullable(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
});

export type RateSummary = z.infer<typeof rateSummarySchema>;

export const durationSummarySchema = z.object({
  averageMs: z.number().nonnegative().nullable(),
  medianMs: z.number().nonnegative().nullable(),
  sampleCount: z.number().int().nonnegative(),
});

export type DurationSummary = z.infer<typeof durationSummarySchema>;

export const aggregatedMetricsResponseSchema = z.object({
  period: metricsPeriodSchema,
  from: z.string().datetime(),
  to: z.string().datetime(),
  timeFromTicketToPr: durationSummarySchema,
  conventionAdherence: rateSummarySchema,
  aiGeneratedTestPassRate: rateSummarySchema,
  workflowCompletionRate: rateSummarySchema,
  totals: z.object({
    workflowsStarted: z.number().int().nonnegative(),
    workflowsCompleted: z.number().int().nonnegative(),
  }),
});

export type AggregatedMetricsResponse = z.infer<typeof aggregatedMetricsResponseSchema>;

export const workflowStageTimingSchema = z.object({
  stage: workflowStateSchema,
  enteredAt: z.string().datetime(),
  exitedAt: z.string().datetime().optional(),
  durationMs: z.number().nonnegative().optional(),
});

export type WorkflowStageTiming = z.infer<typeof workflowStageTimingSchema>;

export const workflowMetricsResponseSchema = z.object({
  workflowId: z.string().min(1),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  timeFromTicketToPrMs: z.number().nonnegative().nullable(),
  reachedPrCreated: z.boolean(),
  currentStage: workflowStateSchema.nullable(),
  stageTimings: z.array(workflowStageTimingSchema),
  conventionAdherence: rateSummarySchema,
  aiGeneratedTestPassRate: rateSummarySchema,
});

export type WorkflowMetricsResponse = z.infer<typeof workflowMetricsResponseSchema>;

/** Pure helpers used by the metrics service and unit tests. */

export function calculateRatePercent(numerator: number, denominator: number): number | null {
  if (denominator <= 0) {
    return null;
  }
  return Math.round((numerator / denominator) * 10_000) / 100;
}

export function calculateAverageMs(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) {
    return null;
  }
  const sum = durationsMs.reduce((acc, value) => acc + value, 0);
  return Math.round(sum / durationsMs.length);
}

export function calculateMedianMs(durationsMs: number[]): number | null {
  if (durationsMs.length === 0) {
    return null;
  }
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
  }
  return sorted[mid] ?? null;
}

export function buildRateSummary(numerator: number, denominator: number): RateSummary {
  return {
    ratePercent: calculateRatePercent(numerator, denominator),
    numerator,
    denominator,
  };
}

export function periodWindow(
  period: MetricsPeriod,
  now: Date = new Date(),
): { from: Date; to: Date } {
  const to = now;
  const from = new Date(to.getTime() - metricsPeriodDays[period] * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function resolveStageTimings(
  transitions: Array<{
    timestamp: string;
    previousState: z.infer<typeof workflowStateSchema>;
    newState: z.infer<typeof workflowStateSchema>;
  }>,
): WorkflowStageTiming[] {
  if (transitions.length === 0) {
    return [];
  }

  const timings: WorkflowStageTiming[] = [];
  const first = transitions[0]!;
  timings.push({
    stage: first.previousState,
    enteredAt: first.timestamp,
  });

  for (const transition of transitions) {
    const open = timings[timings.length - 1];
    if (open && !open.exitedAt) {
      const enteredMs = Date.parse(open.enteredAt);
      const exitedMs = Date.parse(transition.timestamp);
      open.exitedAt = transition.timestamp;
      if (Number.isFinite(enteredMs) && Number.isFinite(exitedMs) && exitedMs >= enteredMs) {
        open.durationMs = exitedMs - enteredMs;
      }
    }
    timings.push({
      stage: transition.newState,
      enteredAt: transition.timestamp,
    });
  }

  return timings;
}
