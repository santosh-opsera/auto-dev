import type {
  ManualTicketRequest,
  TicketParseResponse,
  TicketResponse,
} from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchTicket(ticketKey: string): Promise<TicketResponse> {
  return apiFetch<TicketResponse>(`/api/v1/tickets/${encodeURIComponent(ticketKey)}`);
}

export async function fetchTicketManual(ticketKey: string): Promise<TicketResponse> {
  const body: ManualTicketRequest = { ticketKey };
  return apiFetch<TicketResponse>('/api/v1/tickets/manual', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function parseTicket(ticketKey: string): Promise<TicketParseResponse> {
  return apiFetch<TicketParseResponse>(
    `/api/v1/tickets/${encodeURIComponent(ticketKey)}/parse`,
    { method: 'POST' },
  );
}
