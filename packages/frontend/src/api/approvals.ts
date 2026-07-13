import type {
  ApprovalCreateRequest,
  ApprovalRequestResponse,
  ApprovalResolveRequest,
  ApprovalStatusResponse,
} from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchApprovalRequest(requestId: string): Promise<ApprovalRequestResponse> {
  return apiFetch<ApprovalRequestResponse>(
    `/api/v1/approvals/${encodeURIComponent(requestId)}`,
  );
}

export async function fetchApprovalStatus(requestId: string): Promise<ApprovalStatusResponse> {
  return apiFetch<ApprovalStatusResponse>(
    `/api/v1/approvals/${encodeURIComponent(requestId)}/status`,
  );
}

export async function resolveApprovalItem(
  requestId: string,
  itemId: string,
  body: ApprovalResolveRequest,
): Promise<ApprovalRequestResponse> {
  return apiFetch<ApprovalRequestResponse>(
    `/api/v1/approvals/${encodeURIComponent(requestId)}/items/${encodeURIComponent(itemId)}/resolve`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export async function createTicketApproval(
  ticketKey: string,
  body: ApprovalCreateRequest,
): Promise<ApprovalRequestResponse> {
  return apiFetch<ApprovalRequestResponse>(
    `/api/v1/tickets/${encodeURIComponent(ticketKey)}/approvals`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}
