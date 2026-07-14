import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleJiraIssueResponse, sampleNormalizedTicket } from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';
import {
  mockAtlassianRefreshSuccessResponse,
  mockAtlassianRefreshFailureResponse,
} from '../../fixtures/auth.js';
import {
  mockUserWithExpiredJiraToken,
  mockUserWithJiraConnection,
  mockUserWithoutJiraConnection,
} from '../../fixtures/jira.js';
import { TicketService } from './ticketService.js';
import { jiraRestClient } from './jiraRestClient.js';
import { refreshAtlassianAccessToken } from '../auth/atlassianAuthService.js';
import { getUserModel } from '../../models/userModel.js';

vi.mock('../../lib/retry.js', () => ({
  withRetry: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  DEFAULT_RETRY_DELAYS_MS: [1, 1, 1],
  isRetryableHttpStatus: vi.fn(),
}));

vi.mock('./jiraRestClient.js', () => ({
  jiraRestClient: {
    resolveCloudId: vi.fn(),
    getIssue: vi.fn(),
  },
}));

vi.mock('../../lib/encryption.js', () => ({
  decryptSecret: vi.fn((value: string) =>
    value === 'encrypted-refresh' ? 'plain-refresh-token' : 'access-token',
  ),
}));

vi.mock('../../auth/sessionService.js', () => ({
  encryptOAuthToken: vi.fn((token: string) => `encrypted:${token}`),
}));

vi.mock('../auth/atlassianAuthService.js', () => ({
  refreshAtlassianAccessToken: vi.fn(),
}));

vi.mock('../../models/userModel.js', () => ({
  getUserModel: vi.fn(),
}));

function jiraHttpError(status: number): Error & { status: number } {
  const error = new Error(`Jira issue lookup failed with status ${String(status)}`) as Error & {
    status: number;
  };
  error.status = status;
  return error;
}

describe('TicketService', () => {
  const user = {
    _id: 'user-1',
    email: 'alex.dev@example.com',
    atlassian: {
      encryptedAccessToken: 'encrypted',
      scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
    },
  } as never;

  const updateOne = vi.fn().mockResolvedValue({ acknowledged: true });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(jiraRestClient.resolveCloudId).mockResolvedValue('cloud-1');
    vi.mocked(jiraRestClient.getIssue).mockResolvedValue(sampleJiraIssueResponse);
    vi.mocked(getUserModel).mockReturnValue({ updateOne } as never);
  });

  it('fetches tickets via Jira REST only', async () => {
    const service = new TicketService();
    const response = await service.getTicket(user, 'OPL-1234');

    expect(jiraRestClient.resolveCloudId).toHaveBeenCalledWith('access-token', undefined);
    expect(jiraRestClient.getIssue).toHaveBeenCalledWith({
      cloudId: 'cloud-1',
      ticketKey: 'OPL-1234',
      accessToken: 'access-token',
    });
    expect(response.source).toBe('jira-rest');
    expect(response.fallbackUsed).toBeUndefined();
    expect(response.ticket).toEqual(sampleNormalizedTicket);
  });

  it('maps 401 responses to AtlassianReauthorizeRequired', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(jiraHttpError(401));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'AtlassianReauthorizeRequired',
      statusCode: 401,
    });
  });

  it('maps 403 responses to JiraForbidden', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(jiraHttpError(403));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraForbidden',
      statusCode: 403,
    });
  });

  it('maps 404 responses to JiraTicketNotFound', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(jiraHttpError(404));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraTicketNotFound',
      statusCode: 404,
    });
  });

  it('maps 5xx responses to JiraTicketUnavailable', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(jiraHttpError(503));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraTicketUnavailable',
      statusCode: 502,
    });
  });

  it('rejects ticket fetch when Jira scopes are missing', async () => {
    const service = new TicketService();
    const userWithoutJira = {
      ...mockUserWithoutJiraConnection,
    } as never;

    await expect(service.getTicket(userWithoutJira, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraNotConnected',
      statusCode: 412,
    });
  });

  it('refreshes an expired access token and fetches the ticket without user action', async () => {
    vi.mocked(refreshAtlassianAccessToken).mockResolvedValue(mockAtlassianRefreshSuccessResponse);

    const service = new TicketService();
    const response = await service.getTicket(mockUserWithExpiredJiraToken as never, 'OPL-1234');

    expect(refreshAtlassianAccessToken).toHaveBeenCalledWith(
      expect.objectContaining({ refreshToken: 'plain-refresh-token' }),
    );
    expect(updateOne).toHaveBeenCalledWith(
      { _id: mockUserWithExpiredJiraToken._id },
      expect.objectContaining({
        $set: expect.objectContaining({
          'atlassian.encryptedAccessToken': `encrypted:${mockAtlassianRefreshSuccessResponse.access_token}`,
        }),
      }),
    );
    expect(response.ticket).toEqual(sampleNormalizedTicket);
    expect(response.source).toBe('jira-rest');
  });

  it('signals re-authorize when refresh token is revoked', async () => {
    vi.mocked(refreshAtlassianAccessToken).mockRejectedValue(
      new AppError(
        'AtlassianReauthorizeRequired',
        'Atlassian refresh token expired or revoked.',
        401,
        'Reconnect Jira to authorize a new access token.',
      ),
    );

    const service = new TicketService();

    await expect(
      service.getTicket(mockUserWithExpiredJiraToken as never, 'OPL-1234'),
    ).rejects.toMatchObject({
      error: 'AtlassianReauthorizeRequired',
      statusCode: 401,
      suggestedAction: 'Reconnect Jira to authorize a new access token.',
    });

    expect(updateOne).toHaveBeenCalledWith(
      { _id: mockUserWithExpiredJiraToken._id },
      expect.objectContaining({
        $unset: expect.objectContaining({
          'atlassian.encryptedAccessToken': 1,
          'atlassian.encryptedRefreshToken': 1,
          'atlassian.scopes': 1,
        }),
      }),
    );
    expect(mockAtlassianRefreshFailureResponse.error).toBe('invalid_grant');
  });

  it('signals re-authorize when access token expired and refresh token is missing', async () => {
    const expiredWithoutRefresh = {
      ...mockUserWithJiraConnection,
      atlassian: {
        ...mockUserWithJiraConnection.atlassian,
        encryptedRefreshToken: undefined,
        tokenExpiresAt: new Date(Date.now() - 60_000),
      },
    };

    const service = new TicketService();

    await expect(service.getTicket(expiredWithoutRefresh as never, 'OPL-1234')).rejects.toMatchObject({
      error: 'AtlassianReauthorizeRequired',
      statusCode: 401,
    });
  });
});
