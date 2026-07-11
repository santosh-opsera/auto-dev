import type {
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
];

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
