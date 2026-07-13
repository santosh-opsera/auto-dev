import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { PrdCodebaseContextSummary, PrdSections, PrdStatus } from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface PrdDocument extends AuditFields {
  userId: string;
  ticketKey: string;
  ticketIntentId: string;
  approvalRequestId?: string;
  workflowId?: string;
  owner?: string;
  repo?: string;
  version: number;
  previousVersionId?: string;
  status: PrdStatus;
  isActive: boolean;
  sections: PrdSections;
  codebaseContext: PrdCodebaseContextSummary;
  approvedBy?: string;
  approvedAt?: Date;
  rejectedBy?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
}

export type PrdRecord = HydratedDocument<PrdDocument>;

const prdSectionsSubSchema = new mongoose.Schema(
  {
    problemStatement: { type: String, required: true },
    solutionOutline: { type: String, required: true },
    userStories: { type: [String], required: true },
    acceptanceCriteria: { type: [String], required: true },
    scopeBoundaries: { type: [String], required: true },
    dependencies: { type: [String], required: true },
    risks: { type: [String], required: true },
    successMetrics: { type: [String], required: true },
  },
  { _id: false },
);

const prdCodebaseContextSubSchema = new mongoose.Schema(
  {
    affectedModules: { type: [String], required: true },
    applicablePatterns: { type: [String], required: true },
    integrationPoints: { type: [String], required: true },
  },
  { _id: false },
);

const prdSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  ticketKey: { type: String, required: true, index: true },
  ticketIntentId: { type: String, required: true, index: true },
  approvalRequestId: { type: String, required: false },
  workflowId: { type: String, required: false },
  owner: { type: String, required: false },
  repo: { type: String, required: false },
  version: { type: Number, required: true },
  previousVersionId: { type: String, required: false },
  status: {
    type: String,
    enum: ['draft', 'in_review', 'approved', 'rejected'],
    required: true,
  },
  isActive: { type: Boolean, required: true, default: true },
  sections: { type: prdSectionsSubSchema, required: true },
  codebaseContext: { type: prdCodebaseContextSubSchema, required: true },
  approvedBy: { type: String, required: false },
  approvedAt: { type: Date, required: false },
  rejectedBy: { type: String, required: false },
  rejectedAt: { type: Date, required: false },
  rejectionReason: { type: String, required: false },
});

prdSchema.index({ userId: 1, ticketKey: 1, version: -1 });
prdSchema.index({ userId: 1, ticketKey: 1, isActive: 1 });

export function getPrdModel(): Model<PrdDocument> {
  if (mongoose.models.PrdDocument) {
    return mongoose.models.PrdDocument as Model<PrdDocument>;
  }

  return mongoose.model<PrdDocument>('PrdDocument', prdSchema, 'prds');
}
