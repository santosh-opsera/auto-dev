import { describe, expect, it } from 'vitest';
import {
  mockGitHubApiOrganizationsResponse,
  mockGitHubApiOrgRepositoryResponse,
  mockGitHubApiRateLimitWarningHeaders,
  sampleGitHubRateLimitStatus,
  sampleGitHubRepositories,
} from './fixtures/repositories.js';
import {
  githubRepositorySchema,
  repositoryConnectResponseSchema,
  repositoryListResponseSchema,
} from './repositories.js';

describe('repository schemas', () => {
  it('validates repository list responses including rate-limit metadata', () => {
    const payload = repositoryListResponseSchema.parse({
      repositories: sampleGitHubRepositories,
      rateLimit: sampleGitHubRateLimitStatus,
      rateLimitWarning: 'GitHub API rate limit is low (42 of 5000 remaining).',
    });

    expect(payload.repositories).toHaveLength(3);
    expect(githubRepositorySchema.parse(sampleGitHubRepositories[0]).fullName).toBe(
      'santosh-opsera/auto-dev',
    );
    expect(payload.rateLimit?.remaining).toBe(42);
    expect(mockGitHubApiOrganizationsResponse[0]?.login).toBe('acme-corp');
    expect(mockGitHubApiOrgRepositoryResponse[0]?.full_name).toBe('acme-corp/shared-lib');
    expect(Number(mockGitHubApiRateLimitWarningHeaders['x-ratelimit-remaining'])).toBe(42);
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
