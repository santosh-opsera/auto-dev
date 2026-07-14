import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockGitHubApiRateLimitWarningHeaders,
  sampleGitHubRepositories,
  sampleRepositoryListCacheDocument,
} from '@autodev/shared-types';
import { ensureIndexes } from '../../database/indexes.js';
import { encryptSecret } from '../../lib/encryption.js';
import {
  buildRepositoryListCacheTimestamps,
  getRepositoryListCacheModel,
  REPOSITORY_LIST_CACHE_TTL_MS,
} from '../../models/repositoryListCacheModel.js';
import type { UserDocument } from '../../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { AppError } from '../../utils/errors.js';
import { GitHubApiClient } from './githubApiClient.js';
import { GitHubRateLimiter } from './githubRateLimiter.js';
import { RepositoryService } from './repositoryService.js';

function buildUser(userId = 'user-1'): UserDocument {
  return {
    _id: userId,
    github: {
      encryptedAccessToken: encryptSecret('gho_test_token'),
      scopes: ['repo', 'read:org'],
    },
  } as unknown as UserDocument;
}

describe('RepositoryService.listRepositories cache', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getRepositoryListCacheModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    vi.restoreAllMocks();
    await getRepositoryListCacheModel().deleteMany({}).exec();
  });

  it('fetches from GitHub on cache miss and stores TTL cache metadata', async () => {
    const limiter = new GitHubRateLimiter();
    limiter.updateFromHeaders(new Headers(mockGitHubApiRateLimitWarningHeaders));
    const client = {
      listRepositories: vi.fn().mockResolvedValue(sampleGitHubRepositories),
      getRateLimiter: () => limiter,
    } as unknown as GitHubApiClient;

    const service = new RepositoryService(client);
    const result = await service.listRepositories(buildUser());

    expect(client.listRepositories).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.cachedAt).toBeTruthy();
    expect(result.cacheExpiresAt).toBeTruthy();
    expect(result.pagination.totalCount).toBe(3);

    const stored = await getRepositoryListCacheModel().findOne({ userId: 'user-1' }).exec();
    expect(stored?.repositories).toHaveLength(3);
    expect(stored?.freshUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('returns cached repositories within the soft TTL without calling GitHub', async () => {
    const timestamps = buildRepositoryListCacheTimestamps();
    await getRepositoryListCacheModel().create({
      userId: 'user-1',
      repositories: sampleGitHubRepositories,
      cachedAt: timestamps.cachedAt,
      freshUntil: timestamps.freshUntil,
      expiresAt: timestamps.expiresAt,
      dataClassification: 'internal',
    });

    const client = {
      listRepositories: vi.fn(),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);

    const result = await service.listRepositories(buildUser());
    expect(client.listRepositories).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.repositories).toHaveLength(3);
    expect(result.cachedAt).toBe(timestamps.cachedAt.toISOString());
    expect(result.cacheExpiresAt).toBe(timestamps.freshUntil.toISOString());
  });

  it('invalidates cache on refresh and fetches fresh GitHub data', async () => {
    const timestamps = buildRepositoryListCacheTimestamps();
    await getRepositoryListCacheModel().create({
      userId: 'user-1',
      repositories: sampleGitHubRepositories.slice(0, 1),
      cachedAt: timestamps.cachedAt,
      freshUntil: timestamps.freshUntil,
      expiresAt: timestamps.expiresAt,
      dataClassification: 'internal',
    });

    const client = {
      listRepositories: vi.fn().mockResolvedValue(sampleGitHubRepositories),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);

    const result = await service.listRepositories(buildUser(), { refresh: true });
    expect(client.listRepositories).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.repositories).toHaveLength(3);
  });

  it('treats soft-expired cache as stale and refetches from GitHub', async () => {
    const cachedAt = new Date(Date.now() - REPOSITORY_LIST_CACHE_TTL_MS - 1_000);
    const timestamps = buildRepositoryListCacheTimestamps(cachedAt);
    await getRepositoryListCacheModel().create({
      userId: 'user-1',
      repositories: sampleGitHubRepositories.slice(0, 1),
      ...timestamps,
      dataClassification: 'internal',
    });

    const client = {
      listRepositories: vi.fn().mockResolvedValue(sampleGitHubRepositories),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);

    const result = await service.listRepositories(buildUser());
    expect(client.listRepositories).toHaveBeenCalledTimes(1);
    expect(result.fromCache).toBe(false);
    expect(result.repositories).toHaveLength(3);
  });

  it('returns stale cache with warning when GitHub fails', async () => {
    const timestamps = buildRepositoryListCacheTimestamps(
      new Date(Date.now() - REPOSITORY_LIST_CACHE_TTL_MS - 5_000),
    );
    await getRepositoryListCacheModel().create({
      userId: 'user-1',
      repositories: sampleGitHubRepositories,
      ...timestamps,
      dataClassification: 'internal',
    });

    const client = {
      listRepositories: vi.fn().mockRejectedValue(
        new AppError('GitHubRateLimited', 'GitHub API rate limit exceeded.', 403, 'Retry later.'),
      ),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);

    const result = await service.listRepositories(buildUser());
    expect(result.fromCache).toBe(true);
    expect(result.cacheWarning).toMatch(/cached repositories/i);
    expect(result.cacheWarning).toContain(timestamps.cachedAt.toISOString());
    expect(result.repositories).toHaveLength(3);
  });

  it('exposes cache fixture shape for reproducibility', () => {
    expect(sampleRepositoryListCacheDocument.repositories).toHaveLength(3);
    expect(sampleRepositoryListCacheDocument.freshUntil).toBe('2026-07-14T12:05:00.000Z');
  });
});
