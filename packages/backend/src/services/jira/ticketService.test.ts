import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sampleJiraIssueResponse, sampleNormalizedTicket } from '@autodev/shared-types';
import { TicketService } from './ticketService.js';
import { forgeTicketClient } from './forgeTicketClient.js';
import { jiraRestClient } from './jiraRestClient.js';

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
  decryptSecret: vi.fn(() => 'access-token'),
}));

describe('TicketService', () => {
  const user = {
    _id: 'user-1',
    email: 'alex.dev@example.com',
    atlassian: {
      encryptedAccessToken: 'encrypted',
    },
  } as never;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(forgeTicketClient.isConfigured).mockReturnValue(true);
    vi.mocked(forgeTicketClient.getIssue).mockRejectedValue(new Error('forge unavailable'));
    vi.mocked(jiraRestClient.resolveCloudId).mockResolvedValue('cloud-1');
    vi.mocked(jiraRestClient.getIssue).mockResolvedValue(sampleJiraIssueResponse);
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
});
