import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import * as ticketsApi from '../api/tickets';
import { mockTicketParseSuccess, mockTicketResponse } from '../fixtures/tickets';
import { useTicketIngestion } from './useTicketIngestion';

/** ApiError fixtures for Jira re-authorize UX (WO-010). */
export const jiraApiErrorFixtures = {
  tokenRevoked: new ApiError(
    'Atlassian access was revoked.',
    401,
    undefined,
    'AtlassianTokenRevoked',
    'Re-connect Jira from the integrations page',
  ),
  refreshInvalid: new ApiError(
    'Atlassian refresh token is invalid or expired.',
    401,
    undefined,
    'AtlassianRefreshInvalid',
    'Re-authorize Jira access',
  ),
  sessionExpired: new ApiError(
    'Atlassian session expired.',
    401,
    undefined,
    'AtlassianSessionExpired',
    'Reconnect Jira to authorize a new access token.',
  ),
  notConnected: new ApiError(
    'Jira access has not been granted for this account.',
    412,
    undefined,
    'JiraNotConnected',
    'Connect Jira read permissions, then retry ticket ingestion.',
  ),
} as const;

describe('useTicketIngestion', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads and parses a ticket successfully', async () => {
    vi.spyOn(ticketsApi, 'fetchTicket').mockResolvedValue(mockTicketResponse);
    vi.spyOn(ticketsApi, 'parseTicket').mockResolvedValue(mockTicketParseSuccess);

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    await waitFor(() => {
      expect(result.current.phase).toBe('complete');
    });

    expect(result.current.displayIntent?.ticketKey).toBe('OPL-1234');
    expect(result.current.canProceed).toBe(true);
  });

  it('captures fetch errors', async () => {
    vi.spyOn(ticketsApi, 'fetchTicket').mockRejectedValue(new Error('Jira unavailable'));

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Jira unavailable');
    expect(result.current.errorCode).toBeNull();
  });

  it.each([
    ['AtlassianTokenRevoked', jiraApiErrorFixtures.tokenRevoked],
    ['AtlassianRefreshInvalid', jiraApiErrorFixtures.refreshInvalid],
    ['AtlassianSessionExpired', jiraApiErrorFixtures.sessionExpired],
  ] as const)('detects %s and stores suggestedAction for re-authorize UX', async (code, apiError) => {
    vi.spyOn(ticketsApi, 'fetchTicket').mockRejectedValue(apiError);

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.errorCode).toBe(code);
    expect(result.current.suggestedAction).toBe(apiError.suggestedAction);
  });

  it('detects JiraNotConnected for first-time connect UX', async () => {
    vi.spyOn(ticketsApi, 'fetchTicket').mockRejectedValue(jiraApiErrorFixtures.notConnected);

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    expect(result.current.errorCode).toBe('JiraNotConnected');
    expect(result.current.suggestedAction).toContain('Connect Jira');
  });
});
