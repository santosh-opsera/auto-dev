import type {
  GitHubRepository,
  RepositoryFileResponse,
  RepositoryTreeEntry,
} from '@autodev/shared-types';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { CircuitBreaker } from '../../lib/circuitBreaker.js';
import { AppError } from '../../utils/errors.js';
import { GitHubRateLimiter } from './githubRateLimiter.js';
import { mapGitHubApiError } from './githubErrorMapper.js';

const GITHUB_API_BASE = 'https://api.github.com';

export type GitHubFetchFn = (
  url: string,
  init: RequestInit,
) => Promise<{ status: number; headers: Headers; json: () => Promise<unknown> }>;

interface GitHubRepositoryResponse {
  id: number;
  name: string;
  full_name: string;
  owner: { login: string };
  private: boolean;
  default_branch: string;
  html_url: string;
}

interface GitHubTreeResponse {
  tree: Array<{
    path: string;
    type: 'blob' | 'tree';
    sha?: string;
    size?: number;
  }>;
}

interface GitHubFileResponse {
  path: string;
  sha?: string;
  size?: number;
  encoding: 'base64' | 'utf-8';
  content: string;
}

const defaultFetch: GitHubFetchFn = async (url, init) => {
  assertAllowedUrl(url);
  const response = await fetch(url, init);
  return {
    status: response.status,
    headers: response.headers,
    json: () => response.json() as Promise<unknown>,
  };
};

function mapRepository(record: GitHubRepositoryResponse): GitHubRepository {
  return {
    id: record.id,
    name: record.name,
    fullName: record.full_name,
    owner: record.owner.login,
    private: record.private,
    defaultBranch: record.default_branch,
    htmlUrl: record.html_url,
  };
}

function mapTreeEntry(entry: GitHubTreeResponse['tree'][number]): RepositoryTreeEntry {
  return {
    path: entry.path,
    type: entry.type === 'tree' ? 'dir' : 'file',
    sha: entry.sha,
    size: entry.size,
  };
}

function decodeFileContent(response: GitHubFileResponse): RepositoryFileResponse['content'] {
  if (response.encoding === 'utf-8') {
    return response.content;
  }

  return Buffer.from(response.content, 'base64').toString('utf8');
}

export class GitHubApiClient {
  constructor(
    private readonly fetchImpl: GitHubFetchFn = defaultFetch,
    private readonly circuitBreaker = new CircuitBreaker(),
    private readonly rateLimiter: GitHubRateLimiter = new GitHubRateLimiter(),
  ) {}

  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }

  getRateLimiter(): GitHubRateLimiter {
    return this.rateLimiter;
  }

  async listRepositories(accessToken: string): Promise<GitHubRepository[]> {
    return this.request<GitHubRepositoryResponse[]>(accessToken, `${GITHUB_API_BASE}/user/repos?per_page=100`, {
      method: 'GET',
    }).then((records) => records.map(mapRepository));
  }

  async getRepository(accessToken: string, owner: string, repo: string): Promise<GitHubRepository> {
    const record = await this.request<GitHubRepositoryResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
      { method: 'GET' },
    );
    return mapRepository(record);
  }

  async getRepositoryTree(
    accessToken: string,
    owner: string,
    repo: string,
    branch: string,
  ): Promise<RepositoryTreeEntry[]> {
    const response = await this.request<GitHubTreeResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`,
      { method: 'GET' },
    );
    return response.tree.map(mapTreeEntry);
  }

  async getRepositoryFile(
    accessToken: string,
    owner: string,
    repo: string,
    path: string,
  ): Promise<RepositoryFileResponse> {
    const response = await this.request<GitHubFileResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      { method: 'GET' },
    );

    return {
      owner,
      repo,
      path: response.path,
      encoding: response.encoding === 'utf-8' ? 'utf-8' : 'base64',
      content: decodeFileContent(response),
      sha: response.sha,
      size: response.size,
    };
  }

  private async request<T>(
    accessToken: string,
    url: string,
    init: RequestInit,
  ): Promise<T> {
    if (!this.circuitBreaker.canExecute()) {
      const retryAfter = this.circuitBreaker.getRetryAfterSeconds() ?? 30;
      throw new AppError(
        'GitHubCircuitOpen',
        'GitHub API circuit breaker is open due to repeated failures.',
        503,
        `Retry after ${String(retryAfter)} seconds.`,
      );
    }

    await this.rateLimiter.waitForCapacity();

    try {
      const response = await this.fetchImpl(url, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json',
          ...(init.headers ?? {}),
        },
      });

      this.rateLimiter.updateFromHeaders(response.headers);

      if (!response.status || response.status >= 400) {
        this.circuitBreaker.recordFailure();
        let bodyText: string | undefined;
        try {
          const body = (await response.json()) as { message?: string };
          bodyText = body.message;
        } catch {
          bodyText = undefined;
        }
        throw mapGitHubApiError(response.status, bodyText);
      }

      this.circuitBreaker.recordSuccess();
      return (await response.json()) as T;
    } catch (error) {
      if (!(error instanceof AppError)) {
        this.circuitBreaker.recordFailure();
      }
      throw error;
    }
  }
}

export const githubApiClient = new GitHubApiClient();
