import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

/** AI prompts/responses retained 90 days (WO-036). */
export const AI_INTERACTION_LOG_RETENTION_DAYS = 90;
export const AI_INTERACTION_LOG_TTL_SECONDS = AI_INTERACTION_LOG_RETENTION_DAYS * 24 * 60 * 60;

export interface AiInteractionLogDocument extends AuditFields {
  userId: string;
  provider: string;
  model: string;
  promptHash: string;
  /** Field-level encrypted prompt/response payload (Confidential). */
  encryptedPayload: string;
  correlationId?: string;
  expiresAt: Date;
}

export type AiInteractionLogRecord = HydratedDocument<AiInteractionLogDocument>;

const aiInteractionLogSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  provider: { type: String, required: true },
  model: { type: String, required: true },
  promptHash: { type: String, required: true, index: true },
  encryptedPayload: { type: String, required: true },
  correlationId: { type: String, required: false },
  expiresAt: { type: Date, required: true },
});

aiInteractionLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
aiInteractionLogSchema.index({ userId: 1, createdAt: -1 });

export function getAiInteractionLogModel(): Model<AiInteractionLogDocument> {
  if (mongoose.models.AiInteractionLog) {
    return mongoose.models.AiInteractionLog as Model<AiInteractionLogDocument>;
  }

  return mongoose.model<AiInteractionLogDocument>(
    'AiInteractionLog',
    aiInteractionLogSchema,
    'ai_interaction_logs',
  );
}

export function buildAiInteractionExpiryDate(now = Date.now()): Date {
  return new Date(now + AI_INTERACTION_LOG_TTL_SECONDS * 1000);
}
