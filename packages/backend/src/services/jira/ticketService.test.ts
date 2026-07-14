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
import { forgeTicketClient } from './forgeTicketClient.js';
import { jiraRestClient } from './jiraRestClient.js';
import { refreshAtlassianAccessToken } from '../auth/atlassianAuthService.js';
import { getUserModel } from '../../models/userModel.js';

vi.mock('../../lib/retry.js', () => ({
  withRetry: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  DEFAULT_RETRY_DELAYS_MS: [1, 1, 1],
  isRetryableHttpStatus: vi.fn(),
}));

vi.mock('./forgeTicketClient.js', () => ({
  forgeTicketClient: {
    isConfigured: vi.fn(),
    getIssue: vi.fn(),
  },
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
    vi.mocked(forgeTicketClient.isConfigured).mockReturnValue(true);
    vi.mocked(forgeTicketClient.getIssue).mockRejectedValue(new Error('forge unavailable'));
    vi.mocked(jiraRestClient.resolveCloudId).mockResolvedValue('cloud-1');
    vi.mocked(jiraRestClient.getIssue).mockResolvedValue(sampleJiraIssueResponse);
    vi.mocked(getUserModel).mockReturnValue({ updateOne } as never);
  });

  it('falls back to Jira REST when Forge is unavailable', async () => {
    const service = new TicketService();
    const response = await service.getTicket(user, 'OPL-1234');

    expect(response.source).toBe('jira-rest');
    expect(response.fallbackUsed).toBe(true);
    expect(response.ticket).toEqual(sampleNormalizedTicket);
  });

  it('uses Forge when configured and reachable', async () => {
    vi.mocked(forgeTicketClient.getIssue).mockResolvedValue(sampleJiraIssueResponse);

    const service = new TicketService();
    const response = await service.getTicket(user, 'OPL-1234');

    expect(response.source).toBe('forge');
    expect(response.fallbackUsed).toBeUndefined();
  });

  it('forces direct Jira REST for manual fallback requests', async () => {
    const service = new TicketService();
    const response = await service.getTicket(user, 'OPL-1234', true);

    expect(response.source).toBe('jira-rest');
    expect(forgeTicketClient.getIssue).not.toHaveBeenCalled();
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
    vi.mocked(forgeTicketClient.isConfigured).mockReturnValue(false);

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
