import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';
import type { GitHubRepository } from '@autodev/shared-types';

/** Soft-fresh window for serving cache without GitHub API calls. */
export const REPOSITORY_LIST_CACHE_TTL_MS = 5 * 60 * 1000;

/** Hard retention for Mongo TTL cleanup (supports stale-while-error beyond soft TTL). */
export const REPOSITORY_LIST_CACHE_RETENTION_MS = 24 * 60 * 60 * 1000;

export interface RepositoryListCacheDocument extends AuditFields {
  userId: string;
  repositories: GitHubRepository[];
  cachedAt: Date;
  /** Soft freshness deadline (cachedAt + 5 minutes). */
  freshUntil: Date;
  /** Mongo TTL cleanup deadline. */
  expiresAt: Date;
}

export type RepositoryListCacheRecord = HydratedDocument<RepositoryListCacheDocument>;

const githubRepositorySubschema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    name: { type: String, required: true },
    fullName: { type: String, required: true },
    owner: { type: String, required: true },
    private: { type: Boolean, required: true },
    defaultBranch: { type: String, required: true },
    htmlUrl: { type: String, required: true },
  },
  { _id: false },
);

const repositoryListCacheSchema = createBaseSchema({
  userId: { type: String, required: true },
  repositories: { type: [githubRepositorySubschema], required: true, default: [] },
  cachedAt: { type: Date, required: true },
  freshUntil: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
});

repositoryListCacheSchema.index({ userId: 1 }, { unique: true });
repositoryListCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getRepositoryListCacheModel(): Model<RepositoryListCacheDocument> {
  if (mongoose.models.RepositoryListCache) {
    return mongoose.models.RepositoryListCache as Model<RepositoryListCacheDocument>;
  }

  return mongoose.model<RepositoryListCacheDocument>(
    'RepositoryListCache',
    repositoryListCacheSchema,
    'github_repository_list_cache',
  );
}

export function buildRepositoryListCacheTimestamps(
  cachedAt: Date = new Date(),
): { cachedAt: Date; freshUntil: Date; expiresAt: Date } {
  return {
    cachedAt,
    freshUntil: new Date(cachedAt.getTime() + REPOSITORY_LIST_CACHE_TTL_MS),
    expiresAt: new Date(cachedAt.getTime() + REPOSITORY_LIST_CACHE_RETENTION_MS),
  };
}
