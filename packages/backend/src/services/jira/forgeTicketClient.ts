import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import type { JiraIssueResponse } from './ticketNormalizer.js';

export type ForgeIssueFetcher = (input: {
  ticketKey: string;
  accessToken: string;
}) => Promise<JiraIssueResponse>;

const defaultForgeIssueFetcher: ForgeIssueFetcher = async ({ ticketKey, accessToken }) => {
  const bridgeUrl = process.env.FORGE_BRIDGE_URL;

  if (!bridgeUrl) {
    throw new Error('Forge bridge is not configured');
  }

  assertAllowedUrl(bridgeUrl);
  const response = await fetch(`${bridgeUrl.replace(/\/$/, '')}/issues/${encodeURIComponent(ticketKey)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const error = new Error(`Forge bridge request failed with status ${String(response.status)}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  return (await response.json()) as JiraIssueResponse;
};

export class ForgeTicketClient {
  constructor(private readonly issueFetcher: ForgeIssueFetcher = defaultForgeIssueFetcher) {}

  isConfigured(): boolean {
    return Boolean(process.env.FORGE_BRIDGE_URL);
  }

  async getIssue(ticketKey: string, accessToken: string): Promise<JiraIssueResponse> {
    return this.issueFetcher({ ticketKey, accessToken });
  }
}

export const forgeTicketClient = new ForgeTicketClient();
