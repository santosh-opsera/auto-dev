import { decryptSecret } from '../../lib/encryption.js';
import { withRetry } from '../../lib/retry.js';
import { AppError } from '../../utils/errors.js';
import type { UserDocument } from '../../models/userModel.js';
import { refreshAtlassianAccessToken } from '../auth/atlassianAuthService.js';
import { encryptOAuthToken } from '../../auth/sessionService.js';
import { getUserModel } from '../../models/userModel.js';
import type { TicketResponse } from '@autodev/shared-types';
import { forgeTicketClient } from './forgeTicketClient.js';
import { jiraRestClient } from './jiraRestClient.js';
import { normalizeJiraIssue } from './ticketNormalizer.js';

function getAtlassianConfig(): {
  clientId: string;
  clientSecret: string;
} {
  return {
    clientId: process.env.ATLASSIAN_CLIENT_ID ?? 'atlassian-client-id',
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET ?? 'atlassian-client-secret',
  };
}

async function resolveAccessToken(user: UserDocument): Promise<string> {
  const atlassian = user.atlassian;

  if (!atlassian?.encryptedAccessToken) {
    throw new AppError(
      'AtlassianNotConnected',
      'Connect Atlassian before retrieving Jira tickets.',
      412,
      'Link your Atlassian account and grant Jira access, then retry.',
    );
  }

  const expiresAt = atlassian.tokenExpiresAt?.getTime();
  const isExpired = expiresAt !== undefined && expiresAt <= Date.now();

  if (!isExpired) {
    return decryptSecret(atlassian.encryptedAccessToken);
  }

  if (!atlassian.encryptedRefreshToken) {
    throw new AppError(
      'AtlassianSessionExpired',
      'Atlassian session expired.',
      401,
      'Sign in with Atlassian again to refresh Jira access.',
    );
  }

  const config = getAtlassianConfig();
  const refreshed = await refreshAtlassianAccessToken({
    refreshToken: decryptSecret(atlassian.encryptedRefreshToken),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
  });

  await getUserModel().updateOne(
    { _id: user._id },
    {
      $set: {
        'atlassian.encryptedAccessToken': encryptOAuthToken(refreshed.access_token),
        ...(refreshed.refresh_token
          ? { 'atlassian.encryptedRefreshToken': encryptOAuthToken(refreshed.refresh_token) }
          : {}),
        ...(refreshed.expires_in
          ? {
              'atlassian.tokenExpiresAt': new Date(Date.now() + refreshed.expires_in * 1000),
            }
          : {}),
        ...(refreshed.scope ? { 'atlassian.scopes': refreshed.scope.split(' ') } : {}),
      },
    },
  );

  return refreshed.access_token;
}

export class TicketService {
  async getTicket(user: UserDocument, ticketKey: string, forceRest = false): Promise<TicketResponse> {
    const accessToken = await resolveAccessToken(user);
    const preferredSiteUrl = process.env.ATLASSIAN_SITE_URL;
    const cloudId = await jiraRestClient.resolveCloudId(accessToken, preferredSiteUrl);

    if (!forceRest && forgeTicketClient.isConfigured()) {
      try {
        const issue = await withRetry(() =>
          forgeTicketClient.getIssue(ticketKey, accessToken),
        );
        return {
          ticket: normalizeJiraIssue(issue),
          source: 'forge',
        };
      } catch {
        // Fall through to direct Jira REST fallback.
      }
    }

    try {
      const issue = await withRetry(() =>
        jiraRestClient.getIssue({ cloudId, ticketKey, accessToken }),
      );

      return {
        ticket: normalizeJiraIssue(issue),
        source: 'jira-rest',
        fallbackUsed: !forceRest && forgeTicketClient.isConfigured(),
      };
    } catch {
      throw new AppError(
        'JiraTicketUnavailable',
        'Unable to retrieve the Jira ticket after multiple attempts.',
        502,
        'Retry the request or enter the ticket manually using the fallback endpoint.',
      );
    }
  }
}

export const ticketService = new TicketService();
