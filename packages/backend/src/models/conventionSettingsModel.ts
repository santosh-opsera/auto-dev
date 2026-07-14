import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { ReviewerAssignmentRules } from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export type { ReviewerAssignmentRules };

export interface ConventionSettingsDocument extends AuditFields {
  userId: string;
  version: number;
  isActive: boolean;
  previousVersionId?: string;
  commitMessageFormat: string;
  branchNameTemplate?: string;
  branchNamingPattern: string;
  prTitleTemplate: string;
  prDescriptionTemplate: string;
  reviewerAssignmentRules: ReviewerAssignmentRules;
  /** Internal cursor for round-robin reviewer assignment — not exposed via public API. */
  roundRobinCursor?: number;
}

export type ConventionSettingsRecord = HydratedDocument<ConventionSettingsDocument>;

const conventionSettingsSchema = createBaseSchema({
  userId: { type: String, required: true },
  version: { type: Number, required: true },
  isActive: { type: Boolean, required: true, default: true },
  previousVersionId: { type: String, required: false },
  commitMessageFormat: { type: String, required: true },
  branchNameTemplate: { type: String, required: false },
  branchNamingPattern: { type: String, required: true },
  prTitleTemplate: { type: String, required: true },
  prDescriptionTemplate: { type: String, required: true },
  reviewerAssignmentRules: {
    mode: { type: String, enum: ['round-robin', 'code-owner-based', 'manual-list'], required: true },
    reviewers: { type: [String], required: false },
  },
  roundRobinCursor: { type: Number, required: false, default: 0 },
});

conventionSettingsSchema.index({ userId: 1, isActive: 1 });
conventionSettingsSchema.index({ userId: 1, version: -1 });
conventionSettingsSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { isActive: true }, name: 'userId_active_unique' },
);

export function getConventionSettingsModel(): Model<ConventionSettingsDocument> {
  if (mongoose.models.ConventionSettings) {
    return mongoose.models.ConventionSettings as Model<ConventionSettingsDocument>;
  }

  return mongoose.model<ConventionSettingsDocument>(
    'ConventionSettings',
    conventionSettingsSchema,
    'convention_settings',
  );
}
