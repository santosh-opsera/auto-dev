import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface DivergenceItemRecord {
  type: 'naming' | 'pattern' | 'architecture';
  ticketApproach: string;
  codebaseConvention: string;
  recommendation: string;
  severity: 'critical' | 'suggestion';
  affectedFiles: string[];
}

export interface DivergenceRecordDocument extends AuditFields {
  userId: string;
  ticketKey: string;
  ticketIntentId: string;
  codebaseContextId: string;
  owner: string;
  repo: string;
  workflowId: string;
  divergences: DivergenceItemRecord[];
  aligned: boolean;
  summary: string;
}

export type DivergenceRecord = HydratedDocument<DivergenceRecordDocument>;

const divergenceItemSchema = {
  type: { type: String, enum: ['naming', 'pattern', 'architecture'], required: true },
  ticketApproach: { type: String, required: true },
  codebaseConvention: { type: String, required: true },
  recommendation: { type: String, required: true },
  severity: { type: String, enum: ['critical', 'suggestion'], required: true },
  affectedFiles: { type: [String], required: true },
};

const divergenceRecordSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  ticketKey: { type: String, required: true, index: true },
  ticketIntentId: { type: String, required: true, index: true },
  codebaseContextId: { type: String, required: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  workflowId: { type: String, required: true },
  divergences: { type: [divergenceItemSchema], required: true },
  aligned: { type: Boolean, required: true },
  summary: { type: String, required: true },
});

divergenceRecordSchema.index({ userId: 1, ticketKey: 1, createdAt: -1 });

export function getDivergenceRecordModel(): Model<DivergenceRecordDocument> {
  if (mongoose.models.DivergenceRecord) {
    return mongoose.models.DivergenceRecord as Model<DivergenceRecordDocument>;
  }

  return mongoose.model<DivergenceRecordDocument>(
    'DivergenceRecord',
    divergenceRecordSchema,
    'divergence_records',
  );
}
