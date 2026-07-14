import { describe, expect, it, vi } from 'vitest';
import {
  mockGitHubApiFileResponse,
  mockGitHubApiLinkHeaderLastPage,
  mockGitHubApiLinkHeaderPage1,
  mockGitHubApiRepositoryResponse,
  mockGitHubApiTreeResponse,
} from '@autodev/shared-types';
import { GitHubApiClient, parseGitHubNextPageUrl } from './githubApiClient.js';
import { GitHubRateLimiter } from './githubRateLimiter.js';

function createHeaders(remaining = '100'): Headers {
  return new Headers({
    'x-ratelimit-limit': '5000',
    'x-ratelimit-remaining': remaining,
    'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
  });
}

describe('GitHubApiClient', () => {
  it('parses GitHub Link headers into next-page URLs', () => {
    expect(parseGitHubNextPageUrl(mockGitHubApiLinkHeaderPage1)).toBe(
      'https://api.github.com/user/repos?page=2&per_page=100',
    );
    expect(parseGitHubNextPageUrl(mockGitHubApiLinkHeaderLastPage)).toBeNull();
    expect(parseGitHubNextPageUrl(null)).toBeNull();
  });

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

    expect(repositories).toHaveLength(3);
    expect(repositories.map((repository) => repository.fullName)).toEqual([
      'opsera/org-platform',
      'santosh-opsera/auto-dev',
      'santosh-opsera/platform-ui',
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

  it('creates refs, blobs, trees, commits, and updates branch tips', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => ({
          ref: 'refs/heads/main',
          object: { type: 'commit', sha: 'sha-base' },
        }),
      })
      .mockResolvedValueOnce({
        status: 201,
        headers: createHeaders(),
        json: async () => ({
          ref: 'refs/heads/feature/OPL-1',
          object: { type: 'commit', sha: 'sha-base' },
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => ({
          sha: 'sha-base',
          message: 'base',
          tree: { sha: 'tree-base' },
          parents: [],
        }),
      })
      .mockResolvedValueOnce({
        status: 201,
        headers: createHeaders(),
        json: async () => ({ sha: 'blob-1' }),
      })
      .mockResolvedValueOnce({
        status: 201,
        headers: createHeaders(),
        json: async () => ({ sha: 'tree-1' }),
      })
      .mockResolvedValueOnce({
        status: 201,
        headers: createHeaders(),
        json: async () => ({
          sha: 'commit-1',
          message: 'OPL-1: change',
          tree: { sha: 'tree-1' },
          parents: [{ sha: 'sha-base' }],
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        headers: createHeaders(),
        json: async () => ({
          ref: 'refs/heads/feature/OPL-1',
          object: { type: 'commit', sha: 'commit-1' },
        }),
      });

    const client = new GitHubApiClient(fetchImpl, undefined, new GitHubRateLimiter());

    const base = await client.getRef('token', 'o', 'r', 'main');
    expect(base.sha).toBe('sha-base');

    const created = await client.createRef('token', 'o', 'r', 'feature/OPL-1', base.sha);
    expect(created.ref).toBe('refs/heads/feature/OPL-1');

    const commit = await client.getCommit('token', 'o', 'r', base.sha);
    const blob = await client.createBlob('token', 'o', 'r', 'hello');
    const tree = await client.createTree('token', 'o', 'r', commit.treeSha, [
      { path: 'a.ts', mode: '100644', type: 'blob', sha: blob.sha },
    ]);
    const next = await client.createCommit('token', 'o', 'r', {
      message: 'OPL-1: change',
      treeSha: tree.sha,
      parentShas: [commit.sha],
    });
    const updated = await client.updateRef('token', 'o', 'r', 'feature/OPL-1', next.sha);

    expect(updated.sha).toBe('commit-1');
  });
});
