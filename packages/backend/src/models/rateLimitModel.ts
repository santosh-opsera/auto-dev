import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface RateLimitDocument extends AuditFields {
  clientIp: string;
  bucket: string;
  count: number;
  windowStart: Date;
  expiresAt: Date;
}

export type RateLimitRecord = HydratedDocument<RateLimitDocument>;

const rateLimitSchema = createBaseSchema({
  clientIp: { type: String, required: true },
  bucket: { type: String, required: true },
  count: { type: Number, required: true, default: 0 },
  windowStart: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

rateLimitSchema.index({ clientIp: 1, bucket: 1 }, { unique: true });
rateLimitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getRateLimitModel(): Model<RateLimitDocument> {
  if (mongoose.models.RateLimit) {
    return mongoose.models.RateLimit as Model<RateLimitDocument>;
  }

  return mongoose.model<RateLimitDocument>('RateLimit', rateLimitSchema, 'rate_limits');
}

/** Window expiry used for TTL cleanup when the fixed window ends. */
export function buildRateLimitExpiry(windowStart: Date | number, windowMs: number): Date {
  const start = typeof windowStart === 'number' ? windowStart : windowStart.getTime();
  return new Date(start + windowMs);
}
