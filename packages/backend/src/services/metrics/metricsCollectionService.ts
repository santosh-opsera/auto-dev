import {
  buildRateSummary,
  calculateAverageMs,
  calculateMedianMs,
  periodWindow,
  resolveStageTimings,
  type AggregatedMetricsResponse,
  type DomainEvent,
  type MetricsPeriod,
  type WorkflowMetricsResponse,
  type WorkflowStageTiming,
  type WorkflowState,
} from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';
import { logger } from '../../utils/logger.js';
import {
  getWorkflowMetricsModel,
  type WorkflowMetricsDocument,
  type WorkflowMetricsRecord,
} from '../../models/workflowMetricsModel.js';
import type { EventBus } from '../events/eventBus.js';
import { eventBus as defaultEventBus } from '../events/eventBus.js';

function toIso(date: Date | undefined | null): string | null {
  return date ? date.toISOString() : null;
}

function countConventionAdherence(doc: WorkflowMetricsDocument): {
  numerator: number;
  denominator: number;
} {
  const denominator = doc.conventionValidations.length;
  const numerator = doc.conventionValidations.filter(
    (entry) => entry.passed && !entry.corrected,
  ).length;
  return { numerator, denominator };
}

function countFirstPassTests(doc: WorkflowMetricsDocument): {
  numerator: number;
  denominator: number;
} {
  let denominator = 0;
  let numerator = 0;
  for (const run of doc.testRuns) {
    denominator += run.testCount;
    if (run.firstIterationRecorded) {
      const failed = run.firstIterationFailedCount ?? 0;
      numerator += Math.max(0, run.testCount - failed);
    }
  }
  return { numerator, denominator };
}

function mapWorkflowMetrics(doc: WorkflowMetricsRecord): WorkflowMetricsResponse {
  const convention = countConventionAdherence(doc);
  const tests = countFirstPassTests(doc);
  const startedAt = toIso(doc.startedAt);
  const completedAt = toIso(doc.completedAt);
  let timeFromTicketToPrMs: number | null = null;
  if (doc.startedAt && doc.completedAt) {
    timeFromTicketToPrMs = Math.max(0, doc.completedAt.getTime() - doc.startedAt.getTime());
  }

  return {
    workflowId: doc.workflowId,
    startedAt,
    completedAt,
    timeFromTicketToPrMs,
    reachedPrCreated: doc.reachedPrCreated,
    currentStage: doc.currentStage ?? null,
    stageTimings: doc.stageTimings.map((timing) => {
      const mapped: WorkflowStageTiming = {
        stage: timing.stage,
        enteredAt: timing.enteredAt,
      };
      if (timing.exitedAt) {
        mapped.exitedAt = timing.exitedAt;
      }
      if (timing.durationMs !== undefined) {
        mapped.durationMs = timing.durationMs;
      }
      return mapped;
    }),
    conventionAdherence: buildRateSummary(convention.numerator, convention.denominator),
    aiGeneratedTestPassRate: buildRateSummary(tests.numerator, tests.denominator),
  };
}

export function aggregateWorkflowMetrics(
  docs: WorkflowMetricsDocument[],
  period: MetricsPeriod,
  now: Date = new Date(),
): AggregatedMetricsResponse {
  const { from, to } = periodWindow(period, now);
  const durations: number[] = [];
  let workflowsStarted = 0;
  let workflowsCompleted = 0;
  let conventionNumerator = 0;
  let conventionDenominator = 0;
  let testNumerator = 0;
  let testDenominator = 0;

  for (const doc of docs) {
    workflowsStarted += 1;
    if (doc.reachedPrCreated) {
      workflowsCompleted += 1;
    }
    if (doc.startedAt && doc.completedAt) {
      durations.push(Math.max(0, doc.completedAt.getTime() - doc.startedAt.getTime()));
    }
    const convention = countConventionAdherence(doc);
    conventionNumerator += convention.numerator;
    conventionDenominator += convention.denominator;
    const tests = countFirstPassTests(doc);
    testNumerator += tests.numerator;
    testDenominator += tests.denominator;
  }

  return {
    period,
    from: from.toISOString(),
    to: to.toISOString(),
    timeFromTicketToPr: {
      averageMs: calculateAverageMs(durations),
      medianMs: calculateMedianMs(durations),
      sampleCount: durations.length,
    },
    conventionAdherence: buildRateSummary(conventionNumerator, conventionDenominator),
    aiGeneratedTestPassRate: buildRateSummary(testNumerator, testDenominator),
    workflowCompletionRate: buildRateSummary(workflowsCompleted, workflowsStarted),
    totals: {
      workflowsStarted,
      workflowsCompleted,
    },
  };
}

const METRICS_EVENT_TYPES = [
  'WORKFLOW_TRANSITIONED',
  'WORKFLOW_FAILED',
  'PR_CREATED',
  'TESTING_STARTED',
  'TESTING_ITERATION',
  'CONVENTION_VALIDATION',
] as const;

const METRICS_BRIDGE_FLAG = Symbol.for('autodev.metricsEventBridgeInitialized');

type EventBusWithMetricsFlag = EventBus & {
  [METRICS_BRIDGE_FLAG]?: boolean;
};

export class MetricsCollectionService {
  private bus: EventBus = defaultEventBus;
  private readonly workflowQueues = new Map<string, Promise<void>>();

  initialize(bus: EventBus = defaultEventBus): void {
    const flaggedBus = bus as EventBusWithMetricsFlag;
    if (flaggedBus[METRICS_BRIDGE_FLAG]) {
      return;
    }
    flaggedBus[METRICS_BRIDGE_FLAG] = true;
    this.bus = bus;

    for (const eventType of METRICS_EVENT_TYPES) {
      this.bus.subscribe(eventType, async (event) => {
        try {
          await this.enqueueEvent(event);
        } catch (error: unknown) {
          logger.error('Metrics collection handler failed', {
            resource: 'metrics',
            operation: event.type,
            actor: event.metadata.actor,
          });
          if (error instanceof Error) {
            logger.error(error.message, {
              resource: 'metrics',
              operation: 'handleEvent',
              actor: event.metadata.actor,
            });
          }
        }
      });
    }
  }

  private workflowKey(event: DomainEvent): string | null {
    if (!('workflowId' in event.payload) || typeof event.payload.workflowId !== 'string') {
      return null;
    }
    return `${event.metadata.userId}:${event.payload.workflowId}`;
  }

  private async enqueueEvent(event: DomainEvent): Promise<void> {
    const key = this.workflowKey(event);
    if (!key) {
      await this.handleEvent(event);
      return;
    }

    const previous = this.workflowQueues.get(key) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await this.handleEvent(event);
      });
    this.workflowQueues.set(key, next);
    await next;
  }

  async handleEvent(event: DomainEvent): Promise<void> {
    switch (event.type) {
      case 'WORKFLOW_TRANSITIONED':
        await this.onWorkflowTransitioned(event);
        return;
      case 'WORKFLOW_FAILED':
        await this.onWorkflowFailed(event);
        return;
      case 'PR_CREATED':
        await this.onPrCreated(event);
        return;
      case 'TESTING_STARTED':
        await this.onTestingStarted(event);
        return;
      case 'TESTING_ITERATION':
        await this.onTestingIteration(event);
        return;
      case 'CONVENTION_VALIDATION':
        await this.onConventionValidation(event);
        return;
      default:
        return;
    }
  }

  async getAggregatedMetrics(
    userId: string,
    period: MetricsPeriod,
    now: Date = new Date(),
  ): Promise<AggregatedMetricsResponse> {
    const { from, to } = periodWindow(period, now);
    const docs = await getWorkflowMetricsModel()
      .find({
        userId,
        startedAt: { $gte: from, $lte: to },
      })
      .exec();

    return aggregateWorkflowMetrics(docs, period, now);
  }

  async getWorkflowMetrics(userId: string, workflowId: string): Promise<WorkflowMetricsResponse> {
    const doc = await getWorkflowMetricsModel().findOne({ userId, workflowId }).exec();
    if (!doc) {
      throw new AppError(
        'NotFound',
        'No metrics found for this workflow.',
        404,
        'Ensure the workflow has emitted events, or verify the workflow id.',
      );
    }
    return mapWorkflowMetrics(doc);
  }

  private async ensureRecord(
    userId: string,
    workflowId: string,
    at: Date,
  ): Promise<WorkflowMetricsRecord> {
    const doc = await getWorkflowMetricsModel()
      .findOneAndUpdate(
        { userId, workflowId },
        {
          $setOnInsert: {
            userId,
            workflowId,
            reachedPrCreated: false,
            stageTimings: [],
            conventionValidations: [],
            testRuns: [],
            lastEventAt: at,
            createdBy: userId,
            updatedBy: userId,
            dataClassification: 'internal',
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec();

    if (!doc) {
      throw new AppError(
        'InternalError',
        'Failed to create workflow metrics record.',
        500,
        'Retry the operation.',
      );
    }

    return doc;
  }

  private async onWorkflowTransitioned(
    event: Extract<DomainEvent, { type: 'WORKFLOW_TRANSITIONED' }>,
  ): Promise<void> {
    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);

    if (!doc.startedAt) {
      doc.startedAt = at;
    }

    const transitions = [
      ...this.timingsToTransitions(doc.stageTimings),
      {
        timestamp: event.metadata.timestamp,
        previousState: event.payload.previousState,
        newState: event.payload.newState,
      },
    ];
    doc.stageTimings = resolveStageTimings(transitions);
    doc.currentStage = event.payload.newState;
    if (event.payload.newState === 'PR_CREATED') {
      doc.reachedPrCreated = true;
      if (!doc.completedAt) {
        doc.completedAt = at;
      }
    }
    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private async onWorkflowFailed(
    event: Extract<DomainEvent, { type: 'WORKFLOW_FAILED' }>,
  ): Promise<void> {
    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);
    if (!doc.startedAt) {
      doc.startedAt = at;
    }
    doc.currentStage = 'FAILED';
    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private async onPrCreated(
    event: Extract<DomainEvent, { type: 'PR_CREATED' }>,
  ): Promise<void> {
    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);
    if (!doc.startedAt) {
      doc.startedAt = at;
    }
    doc.reachedPrCreated = true;
    doc.completedAt = at;
    doc.currentStage = (doc.currentStage ?? 'PR_CREATED') as WorkflowState;
    if (doc.currentStage !== 'PR_CREATED') {
      doc.currentStage = 'PR_CREATED';
    }
    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private async onTestingStarted(
    event: Extract<DomainEvent, { type: 'TESTING_STARTED' }>,
  ): Promise<void> {
    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);
    if (!doc.startedAt) {
      doc.startedAt = at;
    }

    const existing = doc.testRuns.find((run) => run.chunkId === event.payload.chunkId);
    if (existing) {
      existing.testCount = event.payload.testCount;
      existing.at = at;
    } else {
      doc.testRuns.push({
        chunkId: event.payload.chunkId,
        testCount: event.payload.testCount,
        firstIterationRecorded: false,
        at,
      });
    }
    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private async onTestingIteration(
    event: Extract<DomainEvent, { type: 'TESTING_ITERATION' }>,
  ): Promise<void> {
    if (event.payload.iteration !== 1) {
      return;
    }

    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);
    if (!doc.startedAt) {
      doc.startedAt = at;
    }

    let run = doc.testRuns.find((entry) => entry.chunkId === event.payload.chunkId);
    if (!run) {
      run = {
        chunkId: event.payload.chunkId,
        testCount: event.payload.failedCount,
        firstIterationRecorded: false,
        at,
      };
      doc.testRuns.push(run);
    }

    if (!run.firstIterationRecorded) {
      run.firstIterationFailedCount = event.payload.failedCount;
      run.firstIterationRecorded = true;
      run.at = at;
    }

    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private async onConventionValidation(
    event: Extract<DomainEvent, { type: 'CONVENTION_VALIDATION' }>,
  ): Promise<void> {
    const at = new Date(event.metadata.timestamp);
    const doc = await this.ensureRecord(event.metadata.userId, event.payload.workflowId, at);
    if (!doc.startedAt) {
      doc.startedAt = at;
    }

    doc.conventionValidations.push({
      artifactType: event.payload.artifactType,
      passed: event.payload.passed,
      corrected: event.payload.corrected,
      at,
    });
    doc.lastEventAt = at;
    doc.updatedBy = event.metadata.userId;
    await doc.save();
  }

  private timingsToTransitions(timings: WorkflowStageTiming[]): Array<{
    timestamp: string;
    previousState: WorkflowState;
    newState: WorkflowState;
  }> {
    if (timings.length < 2) {
      return [];
    }

    const transitions: Array<{
      timestamp: string;
      previousState: WorkflowState;
      newState: WorkflowState;
    }> = [];

    for (let i = 1; i < timings.length; i += 1) {
      const previous = timings[i - 1]!;
      const current = timings[i]!;
      transitions.push({
        timestamp: current.enteredAt,
        previousState: previous.stage,
        newState: current.stage,
      });
    }

    return transitions;
  }
}

export const metricsCollectionService = new MetricsCollectionService();
