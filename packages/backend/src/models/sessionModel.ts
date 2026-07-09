import mongoose, { type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface SessionDocument extends AuditFields {
  sessionId: string;
  userId: mongoose.Types.ObjectId;
  refreshTokenHash: string;
  expiresAt: Date;
  lastActivityAt: Date;
}

const sessionSchema = createBaseSchema({
  sessionId: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  refreshTokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  lastActivityAt: { type: Date, required: true },
});

sessionSchema.index({ sessionId: 1 }, { unique: true });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getSessionModel(): Model<SessionDocument> {
  if (mongoose.models.Session) {
    return mongoose.models.Session as Model<SessionDocument>;
  }

  return mongoose.model<SessionDocument>('Session', sessionSchema);
}
