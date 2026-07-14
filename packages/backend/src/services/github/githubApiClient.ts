import type {
  GitHubRepository,
  RepositoryFileResponse,
  RepositoryTreeEntry,
} from '@autodev/shared-types';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { CircuitBreaker } from '@autodev/infrastructure';
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

interface GitHubOrgResponse {
  login: string;
}

/** Parse GitHub `Link` header and return the `rel="next"` URL when present. */
export function parseGitHubNextPageUrl(linkHeader: string | null): string | null {
  if (!linkHeader) {
    return null;
  }

  const nextLink = linkHeader
    .split(',')
    .map((part) => part.trim())
    .find((part) => part.endsWith('rel="next"'));

  if (!nextLink) {
    return null;
  }

  const match = nextLink.match(/<([^>]+)>/);
  return match?.[1] ?? null;
}

function parseNextPageUrl(linkHeader: string | null): string | null {
  return parseGitHubNextPageUrl(linkHeader);
}

function dedupeRepositories(repositories: GitHubRepository[]): GitHubRepository[] {
  const byId = new Map<number, GitHubRepository>();
  for (const repository of repositories) {
    byId.set(repository.id, repository);
  }

  return [...byId.values()].sort((left, right) => left.fullName.localeCompare(right.fullName));
}
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

export interface GitHubGitRef {
  ref: string;
  sha: string;
}

export interface GitHubGitCommit {
  sha: string;
  treeSha: string;
  message: string;
  parentShas: string[];
}

export interface GitHubCreatedBlob {
  sha: string;
}

export interface GitHubCreatedTree {
  sha: string;
}

export interface GitHubPullRequest {
  number: number;
  htmlUrl: string;
  title: string;
  body: string | null;
  headBranch: string;
  baseBranch: string;
  state: string;
}

export interface CreatePullRequestInput {
  title: string;
  head: string;
  base: string;
  body: string;
}

export interface CreateTreeEntry {
  path: string;
  mode: '100644' | '100755' | '040000' | '160000' | '120000';
  type: 'blob' | 'tree' | 'commit';
  sha: string;
}

interface GitHubRefResponse {
  ref: string;
  object: { sha: string; type: string };
}

interface GitHubCommitResponse {
  sha: string;
  message: string;
  tree: { sha: string };
  parents: Array<{ sha: string }>;
}

interface GitHubBlobResponse {
  sha: string;
}

interface GitHubTreeCreateResponse {
  sha: string;
}

interface GitHubPullRequestResponse {
  number: number;
  html_url: string;
  title: string;
  body: string | null;
  head: { ref: string };
  base: { ref: string };
  state: string;
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
    const userRepos = await this.listPaginatedRepositories(
      accessToken,
      `${GITHUB_API_BASE}/user/repos?affiliation=owner,organization_member,collaborator&sort=updated&per_page=100`,
    );

    let orgRepos: GitHubRepository[] = [];
    try {
      const organizations = await this.listPaginatedRecords<GitHubOrgResponse>(
        accessToken,
        `${GITHUB_API_BASE}/user/orgs?per_page=100`,
      );

      const orgRepoLists = await Promise.all(
        organizations.map((organization) =>
          this.listPaginatedRepositories(
            accessToken,
            `${GITHUB_API_BASE}/orgs/${encodeURIComponent(organization.login)}/repos?type=all&sort=updated&per_page=100`,
          ),
        ),
      );

      orgRepos = orgRepoLists.flat();
    } catch {
      // read:org may be unavailable on older tokens; user/repos affiliations still apply.
    }

    return dedupeRepositories([...userRepos, ...orgRepos]);
  }

  private async listPaginatedRepositories(
    accessToken: string,
    initialUrl: string,
  ): Promise<GitHubRepository[]> {
    const records = await this.listPaginatedRecords<GitHubRepositoryResponse>(
      accessToken,
      initialUrl,
    );
    return records.map(mapRepository);
  }

  private async listPaginatedRecords<T>(
    accessToken: string,
    initialUrl: string,
  ): Promise<T[]> {
    const records: T[] = [];
    let nextUrl: string | null = initialUrl;

    while (nextUrl) {
      const page = await this.requestWithHeaders<T[]>(accessToken, nextUrl, { method: 'GET' });
      records.push(...page.data);
      nextUrl = parseNextPageUrl(page.linkHeader);
    }

    return records;
  }

  private async requestWithHeaders<T>(
    accessToken: string,
    url: string,
    init: RequestInit,
  ): Promise<{ data: T; linkHeader: string | null }> {
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
        throw mapGitHubApiError(response.status, bodyText, {
          resetAtMs: this.rateLimiter.getSnapshot().resetAt || undefined,
        });
      }

      this.circuitBreaker.recordSuccess();
      return {
        data: (await response.json()) as T,
        linkHeader: response.headers.get('link'),
      };
    } catch (error) {
      if (!(error instanceof AppError)) {
        this.circuitBreaker.recordFailure();
      }
      throw error;
    }
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

  async getRef(
    accessToken: string,
    owner: string,
    repo: string,
    ref: string,
  ): Promise<GitHubGitRef> {
    const normalized = ref.startsWith('refs/') ? ref : `heads/${ref}`;
    const response = await this.request<GitHubRefResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/${normalized
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      { method: 'GET' },
    );

    return {
      ref: response.ref,
      sha: response.object.sha,
    };
  }

  async createRef(
    accessToken: string,
    owner: string,
    repo: string,
    branchName: string,
    sha: string,
  ): Promise<GitHubGitRef> {
    const response = await this.request<GitHubRefResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha,
        }),
      },
    );

    return {
      ref: response.ref,
      sha: response.object.sha,
    };
  }

  async getCommit(
    accessToken: string,
    owner: string,
    repo: string,
    sha: string,
  ): Promise<GitHubGitCommit> {
    const response = await this.request<GitHubCommitResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${encodeURIComponent(sha)}`,
      { method: 'GET' },
    );

    return {
      sha: response.sha,
      treeSha: response.tree.sha,
      message: response.message,
      parentShas: response.parents.map((parent) => parent.sha),
    };
  }

  async createBlob(
    accessToken: string,
    owner: string,
    repo: string,
    content: string,
    encoding: 'utf-8' | 'base64' = 'utf-8',
  ): Promise<GitHubCreatedBlob> {
    const response = await this.request<GitHubBlobResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, encoding }),
      },
    );

    return { sha: response.sha };
  }

  async createTree(
    accessToken: string,
    owner: string,
    repo: string,
    baseTreeSha: string,
    tree: CreateTreeEntry[],
  ): Promise<GitHubCreatedTree> {
    const response = await this.request<GitHubTreeCreateResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_tree: baseTreeSha,
          tree,
        }),
      },
    );

    return { sha: response.sha };
  }

  async createCommit(
    accessToken: string,
    owner: string,
    repo: string,
    input: {
      message: string;
      treeSha: string;
      parentShas: string[];
    },
  ): Promise<GitHubGitCommit> {
    const response = await this.request<GitHubCommitResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: input.message,
          tree: input.treeSha,
          parents: input.parentShas,
        }),
      },
    );

    return {
      sha: response.sha,
      treeSha: response.tree.sha,
      message: response.message,
      parentShas: response.parents.map((parent) => parent.sha),
    };
  }

  async updateRef(
    accessToken: string,
    owner: string,
    repo: string,
    branchName: string,
    sha: string,
    force = false,
  ): Promise<GitHubGitRef> {
    const response = await this.request<GitHubRefResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branchName
        .split('/')
        .map(encodeURIComponent)
        .join('/')}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sha, force }),
      },
    );

    return {
      ref: response.ref,
      sha: response.object.sha,
    };
  }

  async createPullRequest(
    accessToken: string,
    owner: string,
    repo: string,
    input: CreatePullRequestInput,
  ): Promise<GitHubPullRequest> {
    const response = await this.request<GitHubPullRequestResponse>(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: input.title,
          head: input.head,
          base: input.base,
          body: input.body,
        }),
      },
    );

    return {
      number: response.number,
      htmlUrl: response.html_url,
      title: response.title,
      body: response.body,
      headBranch: response.head.ref,
      baseBranch: response.base.ref,
      state: response.state,
    };
  }

  async requestPullRequestReviewers(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    reviewers: string[],
  ): Promise<void> {
    if (reviewers.length === 0) {
      return;
    }

    await this.request(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls/${String(pullNumber)}/requested_reviewers`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewers }),
      },
    );
  }

  async addPullRequestLabels(
    accessToken: string,
    owner: string,
    repo: string,
    pullNumber: number,
    labels: string[],
  ): Promise<void> {
    if (labels.length === 0) {
      return;
    }

    await this.request(
      accessToken,
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/issues/${String(pullNumber)}/labels`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ labels }),
      },
    );
  }

  private async request<T>(
    accessToken: string,
    url: string,
    init: RequestInit,
  ): Promise<T> {
    const response = await this.requestWithHeaders<T>(accessToken, url, init);
    return response.data;
  }
}

export const githubApiClient = new GitHubApiClient();
