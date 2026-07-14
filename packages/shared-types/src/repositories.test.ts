import { describe, expect, it } from 'vitest';
import {
  mockGitHubApiLinkHeaderLastPage,
  mockGitHubApiLinkHeaderPage1,
  mockGitHubApiOrganizationsResponse,
  mockGitHubApiOrgRepositoryResponse,
  mockGitHubApiPaginatedRepositoryPages,
  mockGitHubApiRateLimitWarningHeaders,
  sampleGitHubRateLimitStatus,
  sampleGitHubRepositories,
  sampleRepositoryPagination,
} from './fixtures/repositories.js';
import {
  githubRepositorySchema,
  repositoryConnectResponseSchema,
  repositoryListQuerySchema,
  repositoryListResponseSchema,
} from './repositories.js';

describe('repository schemas', () => {
  it('validates repository list responses including rate-limit and pagination metadata', () => {
    const payload = repositoryListResponseSchema.parse({
      repositories: sampleGitHubRepositories,
      pagination: sampleRepositoryPagination,
      rateLimit: sampleGitHubRateLimitStatus,
      rateLimitWarning: 'GitHub API rate limit is low (42 of 5000 remaining).',
    });

    expect(payload.repositories).toHaveLength(3);
    expect(githubRepositorySchema.parse(sampleGitHubRepositories[0]).fullName).toBe(
      'santosh-opsera/auto-dev',
    );
    expect(payload.rateLimit?.remaining).toBe(42);
    expect(payload.pagination.perPage).toBe(30);
    expect(mockGitHubApiOrganizationsResponse[0]?.login).toBe('acme-corp');
    expect(mockGitHubApiOrgRepositoryResponse[0]?.full_name).toBe('acme-corp/shared-lib');
    expect(Number(mockGitHubApiRateLimitWarningHeaders['x-ratelimit-remaining'])).toBe(42);
    expect(mockGitHubApiLinkHeaderPage1).toContain('rel="next"');
    expect(mockGitHubApiLinkHeaderLastPage).not.toContain('rel="next"');
    expect(mockGitHubApiPaginatedRepositoryPages.page2).toHaveLength(1);
  });

  it('defaults repository list query pagination params', () => {
    expect(repositoryListQuerySchema.parse({})).toEqual({ page: 1, perPage: 30, refresh: false });
    expect(repositoryListQuerySchema.parse({ page: '2', perPage: '50', q: 'auto', refresh: 'true' })).toEqual({
      page: 2,
      perPage: 50,
      q: 'auto',
      refresh: true,
    });
  });

  it('validates connect responses', () => {
    const payload = repositoryConnectResponseSchema.parse({
      connection: {
        id: 'conn-1',
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        fullName: 'santosh-opsera/auto-dev',
        defaultBranch: 'main',
        connectedAt: '2026-07-11T08:00:00.000Z',
      },
    });

    expect(payload.connection.repo).toBe('auto-dev');
  });
});
