import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';
import type { ErasureRequestStatus } from '@autodev/shared-types';

export interface DataErasureRequestDocument extends AuditFields {
  userId: string;
  confirmationEmail: string;
  status: ErasureRequestStatus;
  requestedAt: Date;
  scheduledFor: Date;
  cancelledAt?: Date | null;
  executedAt?: Date | null;
  executionSummary?: Record<string, unknown> | null;
}

export type DataErasureRequestRecord = HydratedDocument<DataErasureRequestDocument>;

const dataErasureRequestSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  confirmationEmail: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'cancelled', 'executed'],
    required: true,
    default: 'pending',
  },
  requestedAt: { type: Date, required: true },
  scheduledFor: { type: Date, required: true, index: true },
  cancelledAt: { type: Date, required: false, default: null },
  executedAt: { type: Date, required: false, default: null },
  executionSummary: { type: mongoose.Schema.Types.Mixed, required: false, default: null },
});

dataErasureRequestSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'pending' },
    name: 'userId_pending_erasure_unique',
  },
);
dataErasureRequestSchema.index({ status: 1, scheduledFor: 1 });

export function getDataErasureRequestModel(): Model<DataErasureRequestDocument> {
  if (mongoose.models.DataErasureRequest) {
    return mongoose.models.DataErasureRequest as Model<DataErasureRequestDocument>;
  }

  return mongoose.model<DataErasureRequestDocument>(
    'DataErasureRequest',
    dataErasureRequestSchema,
    'data_erasure_requests',
  );
}
