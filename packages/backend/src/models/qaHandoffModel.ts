import type {
  ChangeSummary,
  HandoffCoverageReport,
  HandoffJiraTicket,
  QaFeedbackItem,
  QaHandoffStatus,
  VerificationChecklistItem,
} from '@autodev/shared-types';
import { QA_HANDOFF_STATUSES } from '@autodev/shared-types';
import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface QaHandoffDocument extends AuditFields {
  userId: string;
  workflowDocumentId: string;
  workflowId: string;
  status: QaHandoffStatus;
  changeSummary: ChangeSummary;
  jiraTicket: HandoffJiraTicket;
  coverageReport: HandoffCoverageReport;
  verificationChecklist: VerificationChecklistItem[];
  deploymentUrl: string;
  feedbackItems?: QaFeedbackItem[];
  approvedAt?: Date;
  changesRequestedAt?: Date;
}

export type QaHandoffRecord = HydratedDocument<QaHandoffDocument>;

const uncoveredLineSubSchema = new mongoose.Schema(
  {
    filePath: { type: String, required: true },
    lines: { type: [Number], required: true, default: [] },
  },
  { _id: false },
);

const changeSummarySubSchema = new mongoose.Schema(
  {
    filesChanged: { type: [String], required: true, default: [] },
    linesAdded: { type: Number, required: true },
    linesRemoved: { type: Number, required: true },
    affectedModules: { type: [String], required: false },
  },
  { _id: false },
);

const jiraTicketSubSchema = new mongoose.Schema(
  {
    ticketKey: { type: String, required: true },
    summary: { type: String, required: true },
    acceptanceCriteria: { type: [String], required: true, default: [] },
    url: { type: String, required: false },
  },
  { _id: false },
);

const coverageReportSubSchema = new mongoose.Schema(
  {
    coveragePercent: { type: Number, required: true },
    uncoveredLines: { type: [uncoveredLineSubSchema], required: true, default: [] },
    lines: { type: Number, required: false },
    branches: { type: Number, required: false },
    functions: { type: Number, required: false },
    statements: { type: Number, required: false },
  },
  { _id: false },
);

const checklistItemSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    acceptanceCriterion: { type: String, required: true },
    status: {
      type: String,
      enum: ['unchecked', 'checked', 'blocked'],
      required: true,
    },
    notes: { type: String, required: false },
  },
  { _id: false },
);

const feedbackItemSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    description: { type: String, required: true },
    checklistItemId: { type: String, required: false },
  },
  { _id: false },
);

const qaHandoffSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  workflowDocumentId: { type: String, required: true, index: true },
  workflowId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: [...QA_HANDOFF_STATUSES],
    required: true,
    index: true,
  },
  changeSummary: { type: changeSummarySubSchema, required: true },
  jiraTicket: { type: jiraTicketSubSchema, required: true },
  coverageReport: { type: coverageReportSubSchema, required: true },
  verificationChecklist: { type: [checklistItemSubSchema], required: true, default: [] },
  deploymentUrl: { type: String, required: true },
  feedbackItems: { type: [feedbackItemSubSchema], required: false },
  approvedAt: { type: Date, required: false },
  changesRequestedAt: { type: Date, required: false },
});

qaHandoffSchema.index({ userId: 1, workflowDocumentId: 1 }, { unique: true });
qaHandoffSchema.index({ userId: 1, createdAt: -1 });

export function getQaHandoffModel(): Model<QaHandoffDocument> {
  return (
    (mongoose.models.QaHandoff as Model<QaHandoffDocument> | undefined) ??
    mongoose.model<QaHandoffDocument>('QaHandoff', qaHandoffSchema)
  );
}
