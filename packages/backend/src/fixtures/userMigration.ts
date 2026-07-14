import type { AuthProvider, ProviderTokens } from '../models/userModel.js';

export interface UserMigrationFixture {
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  connectedProviders: AuthProvider[];
  github?: ProviderTokens;
  atlassian?: ProviderTokens;
  requiresGitHubReauth?: boolean;
  createdBy: string;
  updatedBy: string;
  dataClassification: 'confidential';
}

const jiraTokens: ProviderTokens = {
  providerUserId: 'atlassian-acct-legacy-001',
  accountEmail: 'legacy.user@example.com',
  encryptedAccessToken: 'enc:atlassian-access-legacy',
  encryptedRefreshToken: 'enc:atlassian-refresh-legacy',
  tokenExpiresAt: new Date('2026-08-01T00:00:00.000Z'),
  scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
};

const githubTokens: ProviderTokens = {
  providerUserId: '888001',
  accountEmail: 'github.only@example.com',
  encryptedAccessToken: 'enc:github-access-only',
  scopes: ['read:user', 'user:email'],
};

/** Atlassian-only user that migration should flag for GitHub re-auth. */
export const atlassianOnlyUserFixture: UserMigrationFixture = {
  email: 'legacy.user@example.com',
  displayName: 'Legacy Atlassian User',
  role: 'user',
  connectedProviders: ['atlassian'],
  atlassian: jiraTokens,
  requiresGitHubReauth: false,
  createdBy: 'legacy.user@example.com',
  updatedBy: 'legacy.user@example.com',
  dataClassification: 'confidential',
};

/** GitHub-only user — migration must skip. */
export const githubOnlyUserFixture: UserMigrationFixture = {
  email: 'github.only@example.com',
  displayName: 'GitHub Only User',
  role: 'user',
  connectedProviders: ['github'],
  github: githubTokens,
  requiresGitHubReauth: false,
  createdBy: 'github.only@example.com',
  updatedBy: 'github.only@example.com',
  dataClassification: 'confidential',
};

/** Dual-provider user — already migrated / linked; skip. */
export const dualProviderUserFixture: UserMigrationFixture = {
  email: 'dual.user@example.com',
  displayName: 'Dual Provider User',
  role: 'user',
  connectedProviders: ['github', 'atlassian'],
  github: {
    providerUserId: '888002',
    accountEmail: 'dual.user@example.com',
    encryptedAccessToken: 'enc:github-access-dual',
    scopes: ['read:user', 'user:email', 'repo'],
  },
  atlassian: {
    ...jiraTokens,
    providerUserId: 'atlassian-acct-dual-001',
    accountEmail: 'dual.user@example.com',
    encryptedAccessToken: 'enc:atlassian-access-dual',
    encryptedRefreshToken: 'enc:atlassian-refresh-dual',
  },
  requiresGitHubReauth: false,
  createdBy: 'dual.user@example.com',
  updatedBy: 'dual.user@example.com',
  dataClassification: 'confidential',
};

/** Already flagged Atlassian-only user — execute mode should be idempotent. */
export const alreadyFlaggedAtlassianUserFixture: UserMigrationFixture = {
  ...atlassianOnlyUserFixture,
  email: 'already.flagged@example.com',
  displayName: 'Already Flagged User',
  atlassian: {
    ...jiraTokens,
    providerUserId: 'atlassian-acct-flagged-001',
    accountEmail: 'already.flagged@example.com',
  },
  requiresGitHubReauth: true,
  createdBy: 'already.flagged@example.com',
  updatedBy: 'already.flagged@example.com',
};
