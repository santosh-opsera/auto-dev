import {
  sampleJiraIssueResponse,
  samplePartialJiraIssueResponse,
} from '@autodev/shared-types';

export const mockJiraIssues: Record<string, unknown> = {
  'OPL-1234': sampleJiraIssueResponse,
  'OPL-9999': samplePartialJiraIssueResponse,
  'OPL-2001': {
    id: '10010',
    key: 'OPL-2001',
    fields: {
      summary: 'Fix login bug',
      description: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Users cannot login.' }],
          },
        ],
      },
      labels: [],
      attachment: [],
      issuelinks: [],
      issuetype: { name: 'Bug' },
    },
  },
};

export const mockJiraAccessibleResources = [
  {
    id: 'cloud-e2e-001',
    url: 'https://opsera.atlassian.net',
    name: 'Opsera E2E',
    scopes: ['read:jira-work', 'read:jira-user'],
    avatarUrl: 'https://example.com/avatar.png',
  },
];

export const mockAtlassianTokenResponse = {
  access_token: 'atlassian_e2e_access_token',
  refresh_token: 'atlassian_e2e_refresh_token',
  expires_in: 3600,
  scope: 'read:me offline_access read:jira-work read:jira-user',
  token_type: 'Bearer',
};

export const mockAtlassianUserResponse = {
  account_id: 'atlassian-e2e-001',
  email: 'e2e.alex@example.com',
  name: 'E2E Alex',
};
