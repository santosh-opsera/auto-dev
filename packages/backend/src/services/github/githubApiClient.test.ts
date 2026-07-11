import { describe, expect, it, vi } from 'vitest';
import {
  mockGitHubApiFileResponse,
  mockGitHubApiRepositoryResponse,
  mockGitHubApiTreeResponse,
} from '@autodev/shared-types';
import { GitHubApiClient } from './githubApiClient.js';
import { GitHubRateLimiter } from './githubRateLimiter.js';

function createHeaders(remaining = '100'): Headers {
  return new Headers({
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': remaining,
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
  });
}

describe('GitHubApiClient', () => {
  it('lists personal and organization repositories with pagination', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => mockGitHubApiRepositoryResponse,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => [{ login: 'opsera' }],
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => [
          {
            id: 3,
            name: 'org-platform',
            full_name: 'opsera/org-platform',
            owner: { login: 'opsera' },
            private: true,
            default_branch: 'main',
            html_url: 'https://github.com/opsera/org-platform',
          },
        ],
      });
    const client = new GitHubApiClient(fetchImpl);

    const repositories = await client.listRepositories('token');

    expect(repositories).toHaveLength(2);
    expect(repositories.map((repository) => repository.fullName)).toEqual([
      'opsera/org-platform',
      'santosh-opsera/auto-dev',
    ]);
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('affiliation=owner,organization_member,collaborator');
    expect(fetchImpl.mock.calls[2]?.[0]).toContain('/orgs/opsera/repos');
  });

  it('lists repositories and maps responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => mockGitHubApiRepositoryResponse,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => [],
      });
    const client = new GitHubApiClient(fetchImpl);

    const repositories = await client.listRepositories('token');

    expect(repositories[0]?.fullName).toBe('santosh-opsera/auto-dev');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('maps GitHub API errors to structured AppError responses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 404,
      headers: createHeaders(),
      json: async () => ({ message: 'Not Found' }),
    });
    const client = new GitHubApiClient(fetchImpl);

    await expect(client.getRepository('token', 'owner', 'repo')).rejects.toMatchObject({
      error: 'GitHubNotFound',
      statusCode: 404,
    });
  });

  it('opens the circuit breaker after repeated failures', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      status: 500,
      headers: createHeaders(),
      json: async () => ({ message: 'Server error' }),
    });
    const client = new GitHubApiClient(fetchImpl);

    for (let index = 0; index < 5; index += 1) {
      await expect(client.listRepositories('token')).rejects.toBeTruthy();
    }

    await expect(client.listRepositories('token')).rejects.toMatchObject({
      error: 'GitHubCircuitOpen',
      statusCode: 503,
    });
  });

  it('retrieves repository tree and file contents', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => mockGitHubApiTreeResponse,
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => mockGitHubApiFileResponse,
      });

    const client = new GitHubApiClient(fetchImpl, undefined, new GitHubRateLimiter());

    const tree = await client.getRepositoryTree('token', 'santosh-opsera', 'auto-dev', 'main');
    expect(tree).toHaveLength(2);

    const file = await client.getRepositoryFile('token', 'santosh-opsera', 'auto-dev', 'README.md');
    expect(file.content).toContain('AutoDev');
  });
});
