import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';
import { LOCKOUT_WINDOW_MS } from '../auth/constants.js';

export interface LockoutDocument extends AuditFields {
  key: string;
  failures: number;
  firstFailureAt: Date;
  lockedUntil?: Date;
  expiresAt: Date;
}

export type LockoutRecord = HydratedDocument<LockoutDocument>;

const lockoutSchema = createBaseSchema({
  key: { type: String, required: true },
  failures: { type: Number, required: true, default: 0 },
  firstFailureAt: { type: Date, required: true },
  lockedUntil: { type: Date, required: false },
  expiresAt: { type: Date, required: true },
});

lockoutSchema.index({ key: 1 }, { unique: true });
lockoutSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getLockoutModel(): Model<LockoutDocument> {
  if (mongoose.models.AuthLockout) {
    return mongoose.models.AuthLockout as Model<LockoutDocument>;
  }

  return mongoose.model<LockoutDocument>('AuthLockout', lockoutSchema, 'auth_lockouts');
}

/** Window expiry used while counting failures (before lockout). */
export function buildLockoutWindowExpiry(firstFailureAt: Date | number): Date {
  const start = typeof firstFailureAt === 'number' ? firstFailureAt : firstFailureAt.getTime();
  return new Date(start + LOCKOUT_WINDOW_MS);
}

/** Lockout expiry used once the failure threshold is reached. */
export function buildLockoutExpiry(lockedUntil: Date | number): Date {
  return new Date(typeof lockedUntil === 'number' ? lockedUntil : lockedUntil.getTime());
}
