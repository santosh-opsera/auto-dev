export const mockGitHubTokenResponse = {
  access_token: 'gho_e2e_access_token',
  refresh_token: 'gho_e2e_refresh_token',
  expires_in: 3600,
  scope: 'read:user,user:email,repo',
  token_type: 'bearer',
};

export const mockGitHubUserResponse = {
  id: 424242,
  login: 'e2e-alex',
  name: 'E2E Alex',
  email: 'e2e.alex@example.com',
};

export const mockGitHubRepos = [
  {
    id: 1,
    name: 'auto-dev',
    full_name: 'santosh-opsera/auto-dev',
    private: false,
    owner: { login: 'santosh-opsera' },
    default_branch: 'main',
    html_url: 'https://github.com/santosh-opsera/auto-dev',
  },
  {
    id: 2,
    name: 'platform-ui',
    full_name: 'santosh-opsera/platform-ui',
    private: true,
    owner: { login: 'santosh-opsera' },
    default_branch: 'main',
    html_url: 'https://github.com/santosh-opsera/platform-ui',
  },
];

export const mockGitHubTree = {
  tree: [
    { path: 'packages', type: 'tree' },
    { path: 'packages/backend/src/index.ts', type: 'blob', sha: 'abc123', size: 2048 },
    { path: 'README.md', type: 'blob', sha: 'def456', size: 512 },
  ],
  truncated: false,
};

export const mockGitHubFileContent = {
  name: 'README.md',
  path: 'README.md',
  sha: 'def456',
  encoding: 'base64',
  content: Buffer.from('# AutoDev\n\nAI-assisted development platform.\n').toString('base64'),
};
