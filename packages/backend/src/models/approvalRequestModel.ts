import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface ApprovalDecisionRecord {
  action: 'approve' | 'reject' | 'modify';
  rationale?: string;
  modifiedValue?: string;
  resolvedAt: string;
  resolvedBy: string;
}

export interface ApprovalItemRecord {
  itemId: string;
  type: 'gap' | 'divergence';
  status: 'pending' | 'approved' | 'rejected' | 'modified' | 'expired';
  sourceRef: string;
  title: string;
  summary: string;
  gap?: {
    field: string;
    severity: 'critical' | 'warning';
    description: string;
    suggestedAction: string;
  };
  divergence?: {
    type: 'naming' | 'pattern' | 'architecture';
    ticketApproach: string;
    codebaseConvention: string;
    recommendation: string;
    severity: 'critical' | 'suggestion';
    affectedFiles: string[];
  };
  decision?: ApprovalDecisionRecord;
  remindersSent: Array<'24h' | '48h'>;
}

export interface ApprovalRequestDocument extends AuditFields {
  userId: string;
  ticketKey: string;
  workflowId: string;
  ticketIntentId: string;
  divergenceRecordId?: string;
  status: 'open' | 'cleared' | 'blocked';
  items: ApprovalItemRecord[];
  expiresAt: Date;
}

export type ApprovalRequest = HydratedDocument<ApprovalRequestDocument>;

const gapSubSchema = new mongoose.Schema(
  {
    field: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'warning'], required: true },
    description: { type: String, required: true },
    suggestedAction: { type: String, required: true },
  },
  { _id: false },
);

const divergenceSubSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['naming', 'pattern', 'architecture'], required: true },
    ticketApproach: { type: String, required: true },
    codebaseConvention: { type: String, required: true },
    recommendation: { type: String, required: true },
    severity: { type: String, enum: ['critical', 'suggestion'], required: true },
    affectedFiles: { type: [String], required: true },
  },
  { _id: false },
);

const decisionSubSchema = new mongoose.Schema(
  {
    action: { type: String, enum: ['approve', 'reject', 'modify'], required: true },
    rationale: { type: String, required: false },
    modifiedValue: { type: String, required: false },
    resolvedAt: { type: String, required: true },
    resolvedBy: { type: String, required: true },
  },
  { _id: false },
);

const approvalItemSubSchema = new mongoose.Schema(
  {
    itemId: { type: String, required: true },
    type: { type: String, enum: ['gap', 'divergence'], required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'modified', 'expired'],
      required: true,
    },
    sourceRef: { type: String, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    gap: { type: gapSubSchema, required: false },
    divergence: { type: divergenceSubSchema, required: false },
    decision: { type: decisionSubSchema, required: false },
    remindersSent: {
      type: [{ type: String, enum: ['24h', '48h'] }],
      default: [],
    },
  },
  { _id: false },
);

const approvalRequestSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  ticketKey: { type: String, required: true, index: true },
  workflowId: { type: String, required: true },
  ticketIntentId: { type: String, required: true, index: true },
  divergenceRecordId: { type: String, required: false },
  status: { type: String, enum: ['open', 'cleared', 'blocked'], required: true },
  items: { type: [approvalItemSubSchema], required: true },
  expiresAt: { type: Date, required: true, index: true },
});

approvalRequestSchema.index({ userId: 1, ticketKey: 1, createdAt: -1 });
approvalRequestSchema.index({ userId: 1, status: 1, expiresAt: 1 });

export function getApprovalRequestModel(): Model<ApprovalRequestDocument> {
  if (mongoose.models.ApprovalRequest) {
    return mongoose.models.ApprovalRequest as Model<ApprovalRequestDocument>;
  }

  return mongoose.model<ApprovalRequestDocument>(
    'ApprovalRequest',
    approvalRequestSchema,
    'approval_requests',
  );
}
