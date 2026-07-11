import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { CodebaseContext } from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

const ANALYSIS_TTL_SECONDS = 30 * 24 * 60 * 60;

export interface CodebaseContextDocument extends AuditFields {
  userId: string;
  owner: string;
  repo: string;
  branch: string;
  treeFingerprint: string;
  context: CodebaseContext;
  expiresAt: Date;
}

export type CodebaseContextRecord = HydratedDocument<CodebaseContextDocument>;

const codebaseContextSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  branch: { type: String, required: true },
  treeFingerprint: { type: String, required: true },
  context: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});

codebaseContextSchema.index({ userId: 1, owner: 1, repo: 1 }, { unique: true });
codebaseContextSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getCodebaseContextModel(): Model<CodebaseContextDocument> {
  if (mongoose.models.CodebaseContextRecord) {
    return mongoose.models.CodebaseContextRecord as Model<CodebaseContextDocument>;
  }

  return mongoose.model<CodebaseContextDocument>(
    'CodebaseContextRecord',
    codebaseContextSchema,
    'codebase_contexts',
  );
}

export function buildAnalysisExpiryDate(now = Date.now()): Date {
  return new Date(now + ANALYSIS_TTL_SECONDS * 1000);
}
