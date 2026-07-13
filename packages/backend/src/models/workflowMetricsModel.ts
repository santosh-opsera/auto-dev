import type {
  ConventionArtifactType,
  WorkflowStageTiming,
  WorkflowState,
} from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface ConventionValidationEntry {
  artifactType: ConventionArtifactType;
  passed: boolean;
  corrected: boolean;
  at: Date;
}

export interface TestRunEntry {
  chunkId: string;
  testCount: number;
  firstIterationFailedCount?: number;
  firstIterationRecorded: boolean;
  at: Date;
}

export interface WorkflowMetricsDocument extends AuditFields {
  userId: string;
  workflowId: string;
  startedAt?: Date;
  completedAt?: Date;
  reachedPrCreated: boolean;
  currentStage?: WorkflowState;
  stageTimings: WorkflowStageTiming[];
  conventionValidations: ConventionValidationEntry[];
  testRuns: TestRunEntry[];
  lastEventAt: Date;
}

export type WorkflowMetricsRecord = HydratedDocument<WorkflowMetricsDocument>;

const stageTimingSubSchema = new mongoose.Schema(
  {
    stage: { type: String, required: true },
    enteredAt: { type: String, required: true },
    exitedAt: { type: String, required: false },
    durationMs: { type: Number, required: false },
  },
  { _id: false },
);

const conventionValidationSubSchema = new mongoose.Schema(
  {
    artifactType: {
      type: String,
      enum: ['branch', 'commit', 'pr'],
      required: true,
    },
    passed: { type: Boolean, required: true },
    corrected: { type: Boolean, required: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const testRunSubSchema = new mongoose.Schema(
  {
    chunkId: { type: String, required: true },
    testCount: { type: Number, required: true },
    firstIterationFailedCount: { type: Number, required: false },
    firstIterationRecorded: { type: Boolean, required: true, default: false },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const workflowMetricsSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  startedAt: { type: Date, required: false, index: true },
  completedAt: { type: Date, required: false },
  reachedPrCreated: { type: Boolean, required: true, default: false, index: true },
  currentStage: { type: String, required: false },
  stageTimings: { type: [stageTimingSubSchema], required: true, default: [] },
  conventionValidations: { type: [conventionValidationSubSchema], required: true, default: [] },
  testRuns: { type: [testRunSubSchema], required: true, default: [] },
  lastEventAt: { type: Date, required: true, index: true },
});

workflowMetricsSchema.index({ userId: 1, workflowId: 1 }, { unique: true });
workflowMetricsSchema.index({ userId: 1, startedAt: -1 });
workflowMetricsSchema.index({ userId: 1, lastEventAt: -1 });
workflowMetricsSchema.index({ userId: 1, reachedPrCreated: 1, startedAt: -1 });

export function getWorkflowMetricsModel(): Model<WorkflowMetricsDocument> {
  return (
    (mongoose.models.WorkflowMetrics as Model<WorkflowMetricsDocument> | undefined) ??
    mongoose.model<WorkflowMetricsDocument>('WorkflowMetrics', workflowMetricsSchema)
  );
}
