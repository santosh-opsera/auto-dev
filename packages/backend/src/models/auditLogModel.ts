import mongoose, { type HydratedDocument, type Model, Schema } from 'mongoose';
import { DATA_CLASSIFICATIONS } from '../database/baseSchema.js';

export const AUDIT_OPERATIONS = [
  'create',
  'update',
  'delete',
  'login',
  'logout',
  'login_failed',
  'token_refresh',
  'lockout',
] as const;

export type AuditOperation = (typeof AUDIT_OPERATIONS)[number];

/** Minimum retention before TTL expiry (1 year). */
export const AUDIT_LOG_TTL_SECONDS = 365 * 24 * 60 * 60;

export interface AuditLogDocument {
  actor: string;
  resource: string;
  operation: AuditOperation;
  previousValue?: unknown;
  newValue?: unknown;
  correlationId: string;
  ipAddress?: string;
  dataClassification: (typeof DATA_CLASSIFICATIONS)[number];
  createdAt: Date;
}

export type AuditLogRecord = HydratedDocument<AuditLogDocument>;

const IMMUTABLE_ERROR = 'Audit log records are append-only and cannot be modified or deleted.';

const auditLogSchema = new Schema<AuditLogDocument>(
  {
    actor: { type: String, required: true },
    resource: { type: String, required: true },
    operation: { type: String, enum: AUDIT_OPERATIONS, required: true },
    previousValue: { type: Schema.Types.Mixed, required: false },
    newValue: { type: Schema.Types.Mixed, required: false },
    correlationId: { type: String, required: true },
    ipAddress: { type: String, required: false },
    dataClassification: {
      type: String,
      enum: DATA_CLASSIFICATIONS,
      default: 'confidential',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'audit_events',
  },
);

auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: AUDIT_LOG_TTL_SECONDS });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ resource: 1, createdAt: -1 });
auditLogSchema.index({ operation: 1, createdAt: -1 });
auditLogSchema.index({ correlationId: 1 });

function rejectMutation(): void {
  throw new Error(IMMUTABLE_ERROR);
}

auditLogSchema.pre('updateOne', rejectMutation);
auditLogSchema.pre('updateMany', rejectMutation);
auditLogSchema.pre('findOneAndUpdate', rejectMutation);
auditLogSchema.pre('deleteOne', rejectMutation);
auditLogSchema.pre('findOneAndDelete', rejectMutation);
auditLogSchema.pre('replaceOne', rejectMutation);

export function getAuditLogModel(): Model<AuditLogDocument> {
  if (mongoose.models.AuditLog) {
    return mongoose.models.AuditLog as Model<AuditLogDocument>;
  }

  return mongoose.model<AuditLogDocument>('AuditLog', auditLogSchema);
}

export { IMMUTABLE_ERROR };
