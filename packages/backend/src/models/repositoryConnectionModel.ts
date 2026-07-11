import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

export interface RepositoryConnectionDocument extends AuditFields {
  userId: string;
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  connectedAt: Date;
}

export type RepositoryConnectionRecord = HydratedDocument<RepositoryConnectionDocument>;

const repositoryConnectionSchema = createBaseSchema({
  userId: { type: String, required: true, index: true },
  owner: { type: String, required: true },
  repo: { type: String, required: true },
  fullName: { type: String, required: true },
  defaultBranch: { type: String, required: true },
  connectedAt: { type: Date, required: true },
});

repositoryConnectionSchema.index({ userId: 1, owner: 1, repo: 1 }, { unique: true });

export function getRepositoryConnectionModel(): Model<RepositoryConnectionDocument> {
  if (mongoose.models.RepositoryConnection) {
    return mongoose.models.RepositoryConnection as Model<RepositoryConnectionDocument>;
  }

  return mongoose.model<RepositoryConnectionDocument>(
    'RepositoryConnection',
    repositoryConnectionSchema,
  );
}
