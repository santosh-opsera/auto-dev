import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { WorkflowError, WorkflowProgress, WorkflowState } from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface WorkflowTransitionRecordDocument {
  timestamp: Date;
  previousState: WorkflowState;
  newState: WorkflowState;
  trigger: string;
}

export interface WorkflowDocument extends AuditFields {
  userId: string;
  workflowId: string;
  ticketKey: string;
  state: WorkflowState;
  history: WorkflowTransitionRecordDocument[];
  progress?: WorkflowProgress;
  pausedFrom?: WorkflowState | null;
  resumedFrom?: WorkflowState | null;
  error?: WorkflowError | null;
}

export type WorkflowRecord = HydratedDocument<WorkflowDocument>;

const WORKFLOW_STATE_ENUM = [
  'CREATED',
  'TICKET_PARSED',
  'ANALYZING',
  'ANALYSIS_COMPLETE',
  'AWAITING_APPROVAL',
  'APPROVED',
  'IMPLEMENTING',
  'TESTING',
  'TEST_PASSED',
  'PR_CREATING',
  'PR_CREATED',
  'PAUSED',
  'CANCELLED',
  'FAILED',
] as const;

const transitionSubSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, required: true },
    previousState: { type: String, enum: WORKFLOW_STATE_ENUM, required: true },
    newState: { type: String, enum: WORKFLOW_STATE_ENUM, required: true },
    trigger: { type: String, required: true },
  },
  { _id: false },
);

const progressSubSchema = new mongoose.Schema(
  {
    percent: { type: Number, required: false, min: 0, max: 100 },
    phase: { type: String, required: false },
    chunkId: { type: String, required: false },
  },
  { _id: false },
);

const errorSubSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    code: { type: String, required: false },
    failedFrom: { type: String, enum: WORKFLOW_STATE_ENUM, required: false },
  },
  { _id: false },
);

const workflowSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true },
  ticketKey: { type: String, required: true, index: true },
  state: { type: String, enum: WORKFLOW_STATE_ENUM, required: true, index: true },
  history: { type: [transitionSubSchema], required: true, default: [] },
  progress: { type: progressSubSchema, required: false },
  pausedFrom: { type: String, enum: WORKFLOW_STATE_ENUM, required: false, default: null },
  resumedFrom: { type: String, enum: WORKFLOW_STATE_ENUM, required: false, default: null },
  error: { type: errorSubSchema, required: false, default: null },
});

workflowSchema.index({ userId: 1, workflowId: 1 }, { unique: true });
workflowSchema.index({ userId: 1, state: 1, updatedAt: -1 });
workflowSchema.index({ userId: 1, ticketKey: 1, createdAt: -1 });

export function getWorkflowModel(): Model<WorkflowDocument> {
  if (mongoose.models.Workflow) {
    return mongoose.models.Workflow as Model<WorkflowDocument>;
  }

  return mongoose.model<WorkflowDocument>('Workflow', workflowSchema, 'workflows');
}
