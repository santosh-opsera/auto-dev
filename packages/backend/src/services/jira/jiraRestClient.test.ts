import { describe, expect, it, vi, beforeEach } from 'vitest';
import { sampleJiraIssueResponse } from '@autodev/shared-types';
import { JiraRestClient } from './jiraRestClient.js';

describe('JiraRestClient integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retrieves issues through the Atlassian REST gateway', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/accessible-resources')) {
          return new Response(
            JSON.stringify([
              {
                id: 'cloud-1',
                url: 'https://opsera.atlassian.net',
                name: 'Opsera',
                scopes: ['read:jira-work'],
              },
            ]),
            { status: 200 },
          );
        }

        if (url.includes('/rest/api/3/issue/OPL-1234')) {
          return new Response(JSON.stringify(sampleJiraIssueResponse), { status: 200 });
        }

        return new Response('not found', { status: 404 });
      }),
    );

    const client = new JiraRestClient();
    const cloudId = await client.resolveCloudId('token', 'https://opsera.atlassian.net');
    const issue = await client.getIssue({
      cloudId,
      ticketKey: 'OPL-1234',
      accessToken: 'token',
    });

    expect(issue.key).toBe('OPL-1234');
  });
});
