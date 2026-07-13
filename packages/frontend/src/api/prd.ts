import type {
  PrdCreateVersionRequest,
  PrdListResponse,
  PrdRejectRequest,
  PrdResponse,
} from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchPrdById(id: string): Promise<PrdResponse> {
  return apiFetch<PrdResponse>(`/api/v1/prd/${encodeURIComponent(id)}`);
}

export async function fetchLatestPrdForTicket(ticketKey: string): Promise<PrdResponse> {
  return apiFetch<PrdResponse>(`/api/v1/tickets/${encodeURIComponent(ticketKey)}/prd`);
}

export async function fetchPrdVersionHistory(ticketKey: string): Promise<PrdListResponse> {
  return apiFetch<PrdListResponse>(
    `/api/v1/tickets/${encodeURIComponent(ticketKey)}/prd?latest=false`,
  );
}

export async function createPrdVersion(
  id: string,
  body: PrdCreateVersionRequest,
): Promise<PrdResponse> {
  return apiFetch<PrdResponse>(`/api/v1/prd/${encodeURIComponent(id)}/versions`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function approvePrd(id: string): Promise<PrdResponse> {
  return apiFetch<PrdResponse>(`/api/v1/prd/${encodeURIComponent(id)}/approve`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function rejectPrd(id: string, body: PrdRejectRequest): Promise<PrdResponse> {
  return apiFetch<PrdResponse>(`/api/v1/prd/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
