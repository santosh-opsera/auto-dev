import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockGitHubApiRateLimitWarningHeaders,
  sampleGitHubRepositories,
} from '@autodev/shared-types';
import { encryptSecret } from '../../lib/encryption.js';
import type { UserDocument } from '../../models/userModel.js';
import { GitHubApiClient } from './githubApiClient.js';
import { GitHubRateLimiter } from './githubRateLimiter.js';
import { RepositoryService } from './repositoryService.js';

function buildUser(): UserDocument {
  return {
    _id: 'user-1',
    github: {
      encryptedAccessToken: encryptSecret('gho_test_token'),
      scopes: ['repo', 'read:org'],
    },
  } as unknown as UserDocument;
}

function manyRepos(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `repo-${String(index + 1)}`,
    fullName: `owner/repo-${String(index + 1)}`,
    owner: 'owner',
    private: false,
    defaultBranch: 'main',
    htmlUrl: `https://github.com/owner/repo-${String(index + 1)}`,
  }));
}

describe('RepositoryService.listRepositories', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('auto-loads personal and org repositories and returns rate limit status', async () => {
    const limiter = new GitHubRateLimiter();
    limiter.updateFromHeaders(new Headers(mockGitHubApiRateLimitWarningHeaders));

    const client = {
      listRepositories: vi.fn().mockResolvedValue(sampleGitHubRepositories),
      getRateLimiter: () => limiter,
    } as unknown as GitHubApiClient;

    const service = new RepositoryService(client);
    const result = await service.listRepositories(buildUser());

    expect(client.listRepositories).toHaveBeenCalledWith(expect.any(String));
    expect(result.repositories).toHaveLength(3);
    expect(result.pagination).toEqual({
      page: 1,
      perPage: 30,
      totalCount: 3,
      hasNextPage: false,
    });
    expect(result.repositories.some((repo) => repo.owner === 'acme-corp')).toBe(true);
    expect(result.rateLimit?.remaining).toBe(42);
    expect(result.rateLimitWarning).toMatch(/rate limit is low/i);
  });

  it('paginates repository lists with default and custom page sizes', async () => {
    const client = {
      listRepositories: vi.fn().mockResolvedValue(manyRepos(150)),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);

    const firstPage = await service.listRepositories(buildUser());
    expect(firstPage.repositories).toHaveLength(30);
    expect(firstPage.pagination).toEqual({
      page: 1,
      perPage: 30,
      totalCount: 150,
      hasNextPage: true,
    });

    const secondPage = await service.listRepositories(buildUser(), { page: 2, perPage: 50 });
    expect(secondPage.repositories).toHaveLength(50);
    expect(secondPage.repositories[0]?.name).toBe('repo-51');
    expect(secondPage.pagination.hasNextPage).toBe(true);

    const filtered = await service.listRepositories(buildUser(), { page: 1, perPage: 30, q: 'repo-12' });
    expect(filtered.repositories.map((repo) => repo.name)).toEqual(['repo-12', 'repo-120', 'repo-121', 'repo-122', 'repo-123', 'repo-124', 'repo-125', 'repo-126', 'repo-127', 'repo-128', 'repo-129']);
    expect(filtered.pagination.page).toBe(1);
    expect(filtered.pagination.totalCount).toBe(11);
    expect(filtered.pagination.hasNextPage).toBe(false);
  });

  it('returns empty pagination metadata for empty repository lists', async () => {
    const client = {
      listRepositories: vi.fn().mockResolvedValue([]),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;
    const service = new RepositoryService(client);
    const result = await service.listRepositories(buildUser());

    expect(result.repositories).toEqual([]);
    expect(result.pagination).toEqual({
      page: 1,
      perPage: 30,
      totalCount: 0,
      hasNextPage: false,
    });
  });

  it('omits rateLimitWarning when remaining quota is healthy', async () => {
    const limiter = new GitHubRateLimiter();
    limiter.updateFromHeaders(
      new Headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4800',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      }),
    );

    const client = {
      listRepositories: vi.fn().mockResolvedValue(sampleGitHubRepositories.slice(0, 2)),
      getRateLimiter: () => limiter,
    } as unknown as GitHubApiClient;

    const service = new RepositoryService(client);
    const result = await service.listRepositories(buildUser());

    expect(result.rateLimitWarning).toBeUndefined();
    expect(result.rateLimit?.remaining).toBe(4800);
  });

  it('surfaces GitHubRateLimited errors from the client during auto-load', async () => {
    const { AppError } = await import('../../utils/errors.js');
    const client = {
      listRepositories: vi.fn().mockRejectedValue(
        new AppError(
          'GitHubRateLimited',
          'GitHub API rate limit exceeded.',
          403,
          'Rate limit resets around 2026-07-14T12:30:00.000Z (about 20 minutes). Retry after the window opens.',
        ),
      ),
      getRateLimiter: () => new GitHubRateLimiter(),
    } as unknown as GitHubApiClient;

    const service = new RepositoryService(client);
    await expect(service.listRepositories(buildUser())).rejects.toMatchObject({
      error: 'GitHubRateLimited',
      statusCode: 403,
    });
  });
});
