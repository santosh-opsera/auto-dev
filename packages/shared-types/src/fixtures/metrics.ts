import type { DomainEvent } from '../events.js';
import type {
  AggregatedMetricsResponse,
  WorkflowMetricsResponse,
} from '../metrics.js';
import { sampleEventMetadata } from './events.js';

/** Workflow A — completes to PR with perfect convention adherence and first-pass tests. */
export const metricsWorkflowAId = 'workflow-metrics-a';

/** Workflow B — started but never reaches PR_CREATED; needs test fixes. */
export const metricsWorkflowBId = 'workflow-metrics-b';

const baseMeta = {
  ...sampleEventMetadata,
  actor: '507f1f77bcf86cd799439011',
  userId: '507f1f77bcf86cd799439011',
};

export const sampleMetricsWorkflowAEvents: DomainEvent[] = [
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'CREATED',
      newState: 'TICKET_PARSED',
      trigger: 'ticket.parsed',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-001',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:00:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'TICKET_PARSED',
      newState: 'ANALYZING',
      trigger: 'analysis.started',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-002',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:05:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'ANALYZING',
      newState: 'ANALYSIS_COMPLETE',
      trigger: 'analysis.completed',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-003',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:20:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'ANALYSIS_COMPLETE',
      newState: 'IMPLEMENTING',
      trigger: 'implementation.started',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-004',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:30:00.000Z',
    },
  },
  {
    type: 'CONVENTION_VALIDATION',
    payload: {
      workflowId: metricsWorkflowAId,
      artifactType: 'branch',
      passed: true,
      corrected: false,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-005',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:31:00.000Z',
    },
  },
  {
    type: 'CONVENTION_VALIDATION',
    payload: {
      workflowId: metricsWorkflowAId,
      artifactType: 'commit',
      passed: true,
      corrected: false,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-006',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T10:40:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'IMPLEMENTING',
      newState: 'TESTING',
      trigger: 'testing.started',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-007',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:00:00.000Z',
    },
  },
  {
    type: 'TESTING_STARTED',
    payload: {
      workflowId: metricsWorkflowAId,
      chunkId: 'chunk-a-1',
      maxIterations: 5,
      framework: 'vitest',
      testCount: 10,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-008',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:00:30.000Z',
    },
  },
  {
    type: 'TESTING_ITERATION',
    payload: {
      workflowId: metricsWorkflowAId,
      chunkId: 'chunk-a-1',
      iteration: 1,
      maxIterations: 5,
      passed: true,
      failedCount: 0,
      identifiedIssues: [],
      fixesApplied: 0,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-009',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:01:00.000Z',
    },
  },
  {
    type: 'TESTING_PASSED',
    payload: {
      workflowId: metricsWorkflowAId,
      chunkId: 'chunk-a-1',
      iterationsUsed: 1,
      coveragePercent: 92,
      passedCount: 10,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-010',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:01:30.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'TESTING',
      newState: 'PR_CREATING',
      trigger: 'pr.creating',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-011',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:10:00.000Z',
    },
  },
  {
    type: 'CONVENTION_VALIDATION',
    payload: {
      workflowId: metricsWorkflowAId,
      artifactType: 'pr',
      passed: true,
      corrected: false,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-012',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T11:10:30.000Z',
    },
  },
  {
    type: 'PR_CREATED',
    payload: {
      workflowId: metricsWorkflowAId,
      prUrl: 'https://github.com/santosh-opsera/auto-dev/pull/100',
      prNumber: 100,
      reviewers: ['octocat'],
      title: 'OPL-1000 Ship metrics A',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-013',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T12:00:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowAId,
      previousState: 'PR_CREATING',
      newState: 'PR_CREATED',
      trigger: 'pr.created',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-a-014',
      correlationId: 'corr-metrics-a',
      timestamp: '2026-07-01T12:00:00.000Z',
    },
  },
];

export const sampleMetricsWorkflowBEvents: DomainEvent[] = [
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowBId,
      previousState: 'CREATED',
      newState: 'TICKET_PARSED',
      trigger: 'ticket.parsed',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-001',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T09:00:00.000Z',
    },
  },
  {
    type: 'CONVENTION_VALIDATION',
    payload: {
      workflowId: metricsWorkflowBId,
      artifactType: 'branch',
      passed: false,
      corrected: true,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-002',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T09:30:00.000Z',
    },
  },
  {
    type: 'CONVENTION_VALIDATION',
    payload: {
      workflowId: metricsWorkflowBId,
      artifactType: 'branch',
      passed: true,
      corrected: true,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-003',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T09:31:00.000Z',
    },
  },
  {
    type: 'TESTING_STARTED',
    payload: {
      workflowId: metricsWorkflowBId,
      chunkId: 'chunk-b-1',
      maxIterations: 5,
      framework: 'vitest',
      testCount: 8,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-004',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T10:00:00.000Z',
    },
  },
  {
    type: 'TESTING_ITERATION',
    payload: {
      workflowId: metricsWorkflowBId,
      chunkId: 'chunk-b-1',
      iteration: 1,
      maxIterations: 5,
      passed: false,
      failedCount: 2,
      identifiedIssues: ['assertion mismatch'],
      fixesApplied: 1,
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-005',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T10:01:00.000Z',
    },
  },
  {
    type: 'WORKFLOW_TRANSITIONED',
    payload: {
      workflowId: metricsWorkflowBId,
      previousState: 'TICKET_PARSED',
      newState: 'FAILED',
      trigger: 'workflow.failed',
    },
    metadata: {
      ...baseMeta,
      eventId: 'metrics-b-006',
      correlationId: 'corr-metrics-b',
      timestamp: '2026-07-02T11:00:00.000Z',
    },
  },
];

export const sampleMetricsDomainEvents: DomainEvent[] = [
  ...sampleMetricsWorkflowAEvents,
  ...sampleMetricsWorkflowBEvents,
];

/** Expected per-workflow metrics after processing Workflow A fixtures. */
export const expectedWorkflowAMetrics: WorkflowMetricsResponse = {
  workflowId: metricsWorkflowAId,
  startedAt: '2026-07-01T10:00:00.000Z',
  completedAt: '2026-07-01T12:00:00.000Z',
  timeFromTicketToPrMs: 7_200_000,
  reachedPrCreated: true,
  currentStage: 'PR_CREATED',
  stageTimings: [
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
      exitedAt: '2026-07-01T10:20:00.000Z',
      durationMs: 900_000,
    },
    {
      stage: 'ANALYSIS_COMPLETE',
      enteredAt: '2026-07-01T10:20:00.000Z',
      exitedAt: '2026-07-01T10:30:00.000Z',
      durationMs: 600_000,
    },
    {
      stage: 'IMPLEMENTING',
      enteredAt: '2026-07-01T10:30:00.000Z',
      exitedAt: '2026-07-01T11:00:00.000Z',
      durationMs: 1_800_000,
    },
    {
      stage: 'TESTING',
      enteredAt: '2026-07-01T11:00:00.000Z',
      exitedAt: '2026-07-01T11:10:00.000Z',
      durationMs: 600_000,
    },
    {
      stage: 'PR_CREATING',
      enteredAt: '2026-07-01T11:10:00.000Z',
      exitedAt: '2026-07-01T12:00:00.000Z',
      durationMs: 3_000_000,
    },
    {
      stage: 'PR_CREATED',
      enteredAt: '2026-07-01T12:00:00.000Z',
    },
  ],
  conventionAdherence: {
    ratePercent: 100,
    numerator: 3,
    denominator: 3,
  },
  aiGeneratedTestPassRate: {
    ratePercent: 100,
    numerator: 10,
    denominator: 10,
  },
};

/** Expected aggregated metrics for A+B over a window covering both workflows. */
export const expectedAggregatedMetrics30d: AggregatedMetricsResponse = {
  period: '30d',
  from: '2026-06-13T12:00:00.000Z',
  to: '2026-07-13T12:00:00.000Z',
  timeFromTicketToPr: {
    averageMs: 7_200_000,
    medianMs: 7_200_000,
    sampleCount: 1,
  },
  conventionAdherence: {
    // A: 3/3 without correction; B: 0/2 without correction → 3/5 = 60%
    ratePercent: 60,
    numerator: 3,
    denominator: 5,
  },
  aiGeneratedTestPassRate: {
    // A: 10/10 first pass; B: 6/8 first pass → 16/18 ≈ 88.89%
    ratePercent: 88.89,
    numerator: 16,
    denominator: 18,
  },
  workflowCompletionRate: {
    ratePercent: 50,
    numerator: 1,
    denominator: 2,
  },
  totals: {
    workflowsStarted: 2,
    workflowsCompleted: 1,
  },
};
