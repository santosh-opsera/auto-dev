import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as ticketsApi from '../api/tickets';
import { mockTicketParseSuccess, mockTicketResponse } from '../fixtures/tickets';
import { useTicketIngestion } from './useTicketIngestion';

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
    vi.spyOn(ticketsApi, 'fetchTicket').mockRejectedValue(new Error('Forge unavailable'));

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.error).toBe('Forge unavailable');
    expect(result.current.errorCode).toBeNull();
  });

  it('captures AtlassianReauthorizeRequired error codes from API errors', async () => {
    const { ApiError } = await import('../api/client');
    vi.spyOn(ticketsApi, 'fetchTicket').mockRejectedValue(
      new ApiError(
        'Atlassian refresh token expired or revoked.',
        401,
        undefined,
        'AtlassianReauthorizeRequired',
        'Reconnect Jira to authorize a new access token.',
      ),
    );

    const { result } = renderHook(() => useTicketIngestion());

    await act(async () => {
      await result.current.ingestTicket('OPL-1234');
    });

    expect(result.current.phase).toBe('error');
    expect(result.current.errorCode).toBe('AtlassianReauthorizeRequired');
  });
});
