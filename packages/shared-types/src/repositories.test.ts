import { describe, expect, it } from 'vitest';
import { sampleGitHubRepositories } from './fixtures/repositories.js';
import {
  githubRepositorySchema,
  repositoryConnectResponseSchema,
  repositoryListResponseSchema,
} from './repositories.js';

describe('repository schemas', () => {
  it('validates repository list responses', () => {
    const payload = repositoryListResponseSchema.parse({
      repositories: sampleGitHubRepositories,
    });

    expect(payload.repositories).toHaveLength(2);
    expect(githubRepositorySchema.parse(sampleGitHubRepositories[0]).fullName).toBe(
      'santosh-opsera/auto-dev',
    );
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
