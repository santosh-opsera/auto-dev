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
import { TicketService, clearAtlassianRefreshInFlightForTests } from './ticketService.js';
import { jiraRestClient } from './jiraRestClient.js';
import { classifyJiraHttpError } from './jiraErrorClassifier.js';
import { refreshAtlassianAccessToken } from '../auth/atlassianAuthService.js';
import { getUserModel } from '../../models/userModel.js';

vi.mock('./jiraRestClient.js', () => ({
  jiraRestClient: {
    resolveCloudId: vi.fn(),
    getIssue: vi.fn(),
  },
}));

vi.mock('@autodev/infrastructure', () => ({
  decryptSecret: vi.fn((value: string) =>
    value === 'encrypted-refresh' ? 'plain-refresh-token' : 'access-token',
  ),
  withRetry: vi.fn(async (operation: () => Promise<unknown>) => operation()),
  DEFAULT_RETRY_DELAYS_MS: [1, 1, 1],
  isRetryableHttpStatus: (status: number) => status === 429 || status >= 500,
}));

vi.mock('../../auth/sessionService.js', () => ({
  encryptOAuthToken: vi.fn((token: string) => `encrypted:${token}`),
}));

vi.mock('../../auth/oauthConfig.js', () => ({
  getAtlassianConfig: vi.fn(() => ({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost/callback',
    frontendUrl: 'http://localhost:3001',
  })),
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
    clearAtlassianRefreshInFlightForTests();
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

  it('propagates AtlassianTokenExpired from classified Jira 401', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(classifyJiraHttpError(401));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'AtlassianTokenExpired',
      statusCode: 401,
    });
  });

  it('propagates JiraPermissionDenied from classified Jira 403', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(classifyJiraHttpError(403));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraPermissionDenied',
      statusCode: 403,
    });
  });

  it('propagates JiraTicketNotFound from classified Jira 404', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(classifyJiraHttpError(404));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraTicketNotFound',
      statusCode: 404,
    });
  });

  it('propagates JiraNetworkError from classified Jira 5xx', async () => {
    vi.mocked(jiraRestClient.getIssue).mockRejectedValue(classifyJiraHttpError(503));

    const service = new TicketService();

    await expect(service.getTicket(user, 'OPL-1234')).rejects.toMatchObject({
      error: 'JiraNetworkError',
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

  it('signals AtlassianRefreshInvalid when refresh token is revoked', async () => {
    vi.mocked(refreshAtlassianAccessToken).mockRejectedValue(
      new AppError(
        'AtlassianRefreshInvalid',
        'Atlassian refresh token is invalid or expired.',
        401,
        'Re-authorize Jira access',
      ),
    );

    const service = new TicketService();

    await expect(
      service.getTicket(mockUserWithExpiredJiraToken as never, 'OPL-1234'),
    ).rejects.toMatchObject({
      error: 'AtlassianRefreshInvalid',
      statusCode: 401,
      suggestedAction: 'Re-authorize Jira access',
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

  it('deduplicates concurrent refresh calls for the same user', async () => {
    let resolveRefresh!: (value: typeof mockAtlassianRefreshSuccessResponse) => void;
    const refreshGate = new Promise<typeof mockAtlassianRefreshSuccessResponse>((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(refreshAtlassianAccessToken).mockImplementation(() => refreshGate);

    const service = new TicketService();
    const first = service.getTicket(mockUserWithExpiredJiraToken as never, 'OPL-1234');
    const second = service.getTicket(mockUserWithExpiredJiraToken as never, 'OPL-1234');

    expect(refreshAtlassianAccessToken).toHaveBeenCalledTimes(1);
    resolveRefresh(mockAtlassianRefreshSuccessResponse);

    const [a, b] = await Promise.all([first, second]);
    expect(a.ticket).toEqual(sampleNormalizedTicket);
    expect(b.ticket).toEqual(sampleNormalizedTicket);
    expect(refreshAtlassianAccessToken).toHaveBeenCalledTimes(1);
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
