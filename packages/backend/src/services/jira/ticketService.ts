import { decryptSecret } from '../../lib/encryption.js';
import { withRetry } from '../../lib/retry.js';
import { AppError } from '../../utils/errors.js';
import type { UserDocument } from '../../models/userModel.js';
import { getAtlassianConfig } from '../../auth/oauthConfig.js';
import { refreshAtlassianAccessToken } from '../auth/atlassianAuthService.js';
import { encryptOAuthToken } from '../../auth/sessionService.js';
import { getUserModel } from '../../models/userModel.js';
import type { TicketResponse } from '@autodev/shared-types';
import { jiraRestClient } from './jiraRestClient.js';
import { normalizeJiraIssue } from './ticketNormalizer.js';
import { userHasJiraScopes } from './jiraScopes.js';

async function clearAtlassianJiraAccess(userId: UserDocument['_id']): Promise<void> {
  await getUserModel().updateOne(
    { _id: userId },
    {
      $unset: {
        'atlassian.encryptedAccessToken': 1,
        'atlassian.encryptedRefreshToken': 1,
        'atlassian.tokenExpiresAt': 1,
        'atlassian.scopes': 1,
      },
    },
  );
}

function isReauthorizeError(error: unknown): error is AppError {
  return error instanceof AppError && error.error === 'AtlassianReauthorizeRequired';
}

function getHttpStatus(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status?: unknown }).status;
    return typeof status === 'number' ? status : undefined;
  }
  return undefined;
}

function mapJiraIssueError(error: unknown): AppError {
  const status = getHttpStatus(error);

  if (status === 401) {
    return new AppError(
      'AtlassianReauthorizeRequired',
      'Atlassian session is invalid or expired.',
      401,
      'Reconnect Jira to authorize a new access token.',
    );
  }

  if (status === 403) {
    return new AppError(
      'JiraForbidden',
      'You do not have permission to access this Jira ticket.',
      403,
      'Request access to the ticket or use a different Jira account.',
    );
  }

  if (status === 404) {
    return new AppError(
      'JiraTicketNotFound',
      'The requested Jira ticket was not found.',
      404,
      'Verify the ticket key and try again.',
    );
  }

  return new AppError(
    'JiraTicketUnavailable',
    'Unable to retrieve the Jira ticket after multiple attempts.',
    502,
    'Retry the request after a short delay.',
  );
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
    await clearAtlassianJiraAccess(user._id);
    throw new AppError(
      'AtlassianReauthorizeRequired',
      'Atlassian session expired.',
      401,
      'Reconnect Jira to authorize a new access token.',
    );
  }

  const config = getAtlassianConfig();

  try {
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
  } catch (error) {
    await clearAtlassianJiraAccess(user._id);

    if (isReauthorizeError(error)) {
      throw error;
    }

    throw new AppError(
      'AtlassianReauthorizeRequired',
      'Atlassian refresh token expired or revoked.',
      401,
      'Reconnect Jira to authorize a new access token.',
    );
  }
}

export class TicketService {
  async getTicket(user: UserDocument, ticketKey: string): Promise<TicketResponse> {
    if (!userHasJiraScopes(user)) {
      throw new AppError(
        'JiraNotConnected',
        'Jira access has not been granted for this account.',
        412,
        'Connect Jira read permissions, then retry ticket ingestion.',
      );
    }

    const accessToken = await resolveAccessToken(user);
    const preferredSiteUrl = process.env.ATLASSIAN_SITE_URL;

    let cloudId: string;
    try {
      cloudId = await jiraRestClient.resolveCloudId(accessToken, preferredSiteUrl);
    } catch (error) {
      throw new AppError(
        'JiraSiteUnavailable',
        error instanceof Error ? error.message : 'Unable to resolve an accessible Jira site.',
        412,
        'Connect Jira read permissions and verify ATLASSIAN_SITE_URL matches your Jira Cloud site.',
      );
    }

    try {
      const issue = await withRetry(() =>
        jiraRestClient.getIssue({ cloudId, ticketKey, accessToken }),
      );

      return {
        ticket: normalizeJiraIssue(issue),
        source: 'jira-rest',
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw mapJiraIssueError(error);
    }
  }
}

export const ticketService = new TicketService();
