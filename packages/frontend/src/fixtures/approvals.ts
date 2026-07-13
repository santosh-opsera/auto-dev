export {
  sampleApprovalRequestExpired,
  sampleApprovalRequestMixed,
  sampleApprovalRequestPending,
} from '@autodev/shared-types';

import type { ApprovalStatusResponse } from '@autodev/shared-types';
import {
  sampleApprovalRequestExpired,
  sampleApprovalRequestMixed,
  sampleApprovalRequestPending,
} from '@autodev/shared-types';

function buildStatusFromRequest(
  request: typeof sampleApprovalRequestPending,
  canProceed: boolean,
): ApprovalStatusResponse {
  const pendingCount = request.items.filter((item) => item.status === 'pending').length;
  const expiredCount = request.items.filter((item) => item.status === 'expired').length;
  const resolvedCount = request.items.filter((item) =>
    item.status === 'approved' || item.status === 'rejected' || item.status === 'modified',
  ).length;

  return {
    requestId: request.id,
    ticketKey: request.ticketKey,
    canProceed,
    pendingCount,
    expiredCount,
    resolvedCount,
    totalCount: request.items.length,
    status: request.status,
    expiresAt: request.expiresAt,
  };
}

export const mockApprovalStatusPending: ApprovalStatusResponse = buildStatusFromRequest(
  sampleApprovalRequestPending,
  false,
);

export const mockApprovalStatusMixed: ApprovalStatusResponse = buildStatusFromRequest(
  sampleApprovalRequestMixed,
  false,
);

export const mockApprovalStatusCleared: ApprovalStatusResponse = {
  ...buildStatusFromRequest(
    {
      ...sampleApprovalRequestMixed,
      status: 'cleared',
      items: sampleApprovalRequestMixed.items.map((item) =>
        item.status === 'pending'
          ? {
              ...item,
              status: 'approved' as const,
              decision: {
                action: 'approve' as const,
                rationale: 'Accepted remaining item',
                resolvedAt: '2026-07-11T10:00:00.000Z',
                resolvedBy: 'user-001',
              },
            }
          : item,
      ),
    },
    true,
  ),
  status: 'cleared',
  pendingCount: 0,
  resolvedCount: 3,
  canProceed: true,
};

export const mockApprovalStatusExpired: ApprovalStatusResponse = buildStatusFromRequest(
  sampleApprovalRequestExpired,
  false,
);
