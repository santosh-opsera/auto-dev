import type { TicketParseResponse, TicketResponse } from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchTicket(ticketKey: string): Promise<TicketResponse> {
  return apiFetch<TicketResponse>(`/api/v1/tickets/${encodeURIComponent(ticketKey)}`);
}

export async function parseTicket(ticketKey: string): Promise<TicketParseResponse> {
  return apiFetch<TicketParseResponse>(
    `/api/v1/tickets/${encodeURIComponent(ticketKey)}/parse`,
    { method: 'POST' },
  );
}
