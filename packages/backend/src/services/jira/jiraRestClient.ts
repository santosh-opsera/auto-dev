import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import type { JiraIssueResponse } from './ticketNormalizer.js';

const ACCESSIBLE_RESOURCES_URL = 'https://api.atlassian.com/oauth/token/accessible-resources';

export interface AccessibleResource {
  id: string;
  url: string;
  name: string;
  scopes: string[];
}

export type AccessibleResourcesFetcher = (
  accessToken: string,
) => Promise<AccessibleResource[]>;

const defaultAccessibleResourcesFetcher: AccessibleResourcesFetcher = async (accessToken) => {
  assertAllowedUrl(ACCESSIBLE_RESOURCES_URL);
  const response = await fetch(ACCESSIBLE_RESOURCES_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to load Atlassian accessible resources');
  }

  return (await response.json()) as AccessibleResource[];
};

export type JiraIssueFetcher = (input: {
  cloudId: string;
  ticketKey: string;
  accessToken: string;
}) => Promise<JiraIssueResponse>;

function buildIssueUrl(cloudId: string, ticketKey: string): string {
  return `https://api.atlassian.com/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(ticketKey)}?fields=summary,description,labels,attachment,issuelinks,customfield_10020`;
}

const defaultJiraIssueFetcher: JiraIssueFetcher = async ({ cloudId, ticketKey, accessToken }) => {
  const url = buildIssueUrl(cloudId, ticketKey);
  assertAllowedUrl(url);
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = new Error(`Jira issue lookup failed with status ${String(response.status)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return (await response.json()) as JiraIssueResponse;
};

export class JiraRestClient {
  constructor(
    private readonly issueFetcher: JiraIssueFetcher = defaultJiraIssueFetcher,
    private readonly resourcesFetcher: AccessibleResourcesFetcher = defaultAccessibleResourcesFetcher,
  ) {}

  async resolveCloudId(accessToken: string, preferredSiteUrl?: string): Promise<string> {
    const resources = await this.resourcesFetcher(accessToken);
    if (resources.length === 0) {
      throw new Error('No accessible Atlassian sites found for this account');
    }

    if (preferredSiteUrl) {
      const normalizedPreferred = preferredSiteUrl.replace(/\/$/, '');
      const match = resources.find(
        (resource) => resource.url.replace(/\/$/, '') === normalizedPreferred,
      );
      if (match) {
        return match.id;
      }
    }

    return resources[0]!.id;
  }

  async getIssue(input: {
    cloudId: string;
    ticketKey: string;
    accessToken: string;
  }): Promise<JiraIssueResponse> {
    return this.issueFetcher(input);
  }
}

export const jiraRestClient = new JiraRestClient();
