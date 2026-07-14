import type {
  GitHubRateLimitStatus,
  GitHubRepository,
  RepositoryFileResponse,
  RepositoryTreeEntry,
} from '../repositories.js';

export const sampleGitHubRepositories: GitHubRepository[] = [
  {
    id: 1,
    name: 'auto-dev',
    fullName: 'santosh-opsera/auto-dev',
    owner: 'santosh-opsera',
    private: false,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/santosh-opsera/auto-dev',
  },
  {
    id: 2,
    name: 'platform-ui',
    fullName: 'santosh-opsera/platform-ui',
    owner: 'santosh-opsera',
    private: true,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/santosh-opsera/platform-ui',
  },
  {
    id: 3,
    name: 'shared-lib',
    fullName: 'acme-corp/shared-lib',
    owner: 'acme-corp',
    private: true,
    defaultBranch: 'main',
    htmlUrl: 'https://github.com/acme-corp/shared-lib',
  },
];

export const sampleRepositoryTree: RepositoryTreeEntry[] = [
  { path: 'packages', type: 'dir' },
  { path: 'packages/backend', type: 'dir' },
  { path: 'packages/backend/src/index.ts', type: 'file', sha: 'abc123', size: 2048 },
  { path: 'README.md', type: 'file', sha: 'def456', size: 512 },
];

export const sampleRepositoryFile: RepositoryFileResponse = {
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  path: 'README.md',
  encoding: 'utf-8',
  content: '# AutoDev\n\nAI-assisted development platform.',
  sha: 'def456',
  size: 512,
};

/** Personal / affiliation repos returned by GET /user/repos. */
export const mockGitHubApiRepositoryResponse = [
  {
    id: 1,
    name: 'auto-dev',
    full_name: 'santosh-opsera/auto-dev',
    owner: { login: 'santosh-opsera' },
    private: false,
    default_branch: 'main',
    html_url: 'https://github.com/santosh-opsera/auto-dev',
  },
  {
    id: 2,
    name: 'platform-ui',
    full_name: 'santosh-opsera/platform-ui',
    owner: { login: 'santosh-opsera' },
    private: true,
    default_branch: 'main',
    html_url: 'https://github.com/santosh-opsera/platform-ui',
  },
];

/** Organizations returned by GET /user/orgs. */
export const mockGitHubApiOrganizationsResponse = [{ login: 'acme-corp', id: 99 }];

/** Org repos returned by GET /orgs/{org}/repos. */
export const mockGitHubApiOrgRepositoryResponse = [
  {
    id: 3,
    name: 'shared-lib',
    full_name: 'acme-corp/shared-lib',
    owner: { login: 'acme-corp' },
    private: true,
    default_branch: 'main',
    html_url: 'https://github.com/acme-corp/shared-lib',
  },
];

/** Healthy quota headers after a successful auto-load. */
export const mockGitHubApiRateLimitHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '4990',
  'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
};

/** Near-exhaustion warning threshold (< 50 remaining). */
export const mockGitHubApiRateLimitWarningHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '42',
  'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 900),
};

/** Exhausted quota — GitHub often returns 403 with these headers. */
export const mockGitHubApiRateLimitExhaustedHeaders = {
  'x-ratelimit-limit': '5000',
  'x-ratelimit-remaining': '0',
  'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1200),
};

export const sampleGitHubRateLimitStatus: GitHubRateLimitStatus = {
  limit: 5000,
  remaining: 42,
  resetAt: new Date(Date.now() + 900_000).toISOString(),
  queuedRequests: 0,
};

/** Link header for page 1 of a multi-page GitHub list response. */
export const mockGitHubApiLinkHeaderPage1 =
  '<https://api.github.com/user/repos?page=2&per_page=100>; rel="next", <https://api.github.com/user/repos?page=3&per_page=100>; rel="last"';

/** Link header for the final page (no next). */
export const mockGitHubApiLinkHeaderLastPage =
  '<https://api.github.com/user/repos?page=2&per_page=100>; rel="prev", <https://api.github.com/user/repos?page=1&per_page=100>; rel="first"';

/** Two pages of user repos for pagination fixture coverage. */
export const mockGitHubApiPaginatedRepositoryPages = {
  page1: mockGitHubApiRepositoryResponse,
  page2: [
    {
      id: 10,
      name: 'extra-tools',
      full_name: 'santosh-opsera/extra-tools',
      owner: { login: 'santosh-opsera' },
      private: false,
      default_branch: 'main',
      html_url: 'https://github.com/santosh-opsera/extra-tools',
    },
  ],
};

export const sampleRepositoryPagination = {
  page: 1,
  perPage: 30,
  totalCount: sampleGitHubRepositories.length,
  hasNextPage: false,
};

export const mockGitHubApiTreeResponse = {
  sha: 'tree-sha',
  tree: [
    { path: 'packages/backend/src/index.ts', type: 'blob', sha: 'abc123', size: 2048 },
    { path: 'README.md', type: 'blob', sha: 'def456', size: 512 },
  ],
};

export const mockGitHubApiFileResponse = {
  name: 'README.md',
  path: 'README.md',
  sha: 'def456',
  size: 512,
  encoding: 'base64',
  content: 'IyBBdXRvRGV2CgpBSS1hc3Npc3RlZCBkZXZlbG9wbWVudCBwbGF0Zm9ybS4=\n',
};
