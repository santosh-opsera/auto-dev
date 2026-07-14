export {
  sampleJiraIssueResponse,
  sampleNormalizedTicket,
  samplePartialJiraIssueResponse,
} from '@autodev/shared-types';

import { sampleJiraIssueResponse } from '@autodev/shared-types';

export const mockJiraTicketFetchResponse = sampleJiraIssueResponse;

export const mockUserWithJiraConnection = {
  _id: 'user-with-jira',
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github', 'atlassian'] as const,
  atlassian: {
    providerUserId: 'atlassian-account-001',
    accountEmail: 'alex.jira@example.com',
    encryptedAccessToken: 'encrypted-access',
    encryptedRefreshToken: 'encrypted-refresh',
    tokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
  },
};

export const mockUserWithoutJiraConnection = {
  _id: 'user-without-jira',
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github'] as const,
  github: {
    providerUserId: '12345',
    accountEmail: 'alex.dev@example.com',
    encryptedAccessToken: 'encrypted-github-access',
    scopes: ['read:user', 'user:email', 'repo'],
  },
};

export const mockUserWithExpiredJiraToken = {
  ...mockUserWithJiraConnection,
  _id: 'user-expired-jira',
  atlassian: {
    ...mockUserWithJiraConnection.atlassian,
    tokenExpiresAt: new Date(Date.now() - 60_000),
  },
};
