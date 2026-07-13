import type { ApprovalRequestResponse } from '../approval.js';
import { sampleCriticalGaps, sampleWarningGaps } from './ticketIntent.js';
import { sampleExpectedNamingDivergence } from './divergence.js';

export const sampleApprovalRequestPending: ApprovalRequestResponse = {
  id: 'approval-001',
  ticketKey: 'OPL-4001',
  workflowId: 'workflow-approval-001',
  ticketIntentId: 'intent-001',
  divergenceRecordId: 'divergence-001',
  status: 'open',
  expiresAt: '2026-07-14T08:00:00.000Z',
  createdAt: '2026-07-11T08:00:00.000Z',
  updatedAt: '2026-07-11T08:00:00.000Z',
  items: [
    {
      itemId: 'item-gap-001',
      type: 'gap',
      status: 'pending',
      sourceRef: 'acceptanceCriteria',
      title: 'Missing acceptance criteria',
      summary: sampleCriticalGaps[0]!.description,
      gap: sampleCriticalGaps[0],
      remindersSent: [],
    },
    {
      itemId: 'item-gap-002',
      type: 'gap',
      status: 'pending',
      sourceRef: 'description',
      title: 'Vague description',
      summary: sampleWarningGaps[0]!.description,
      gap: sampleWarningGaps[0],
      remindersSent: [],
    },
    {
      itemId: 'item-div-001',
      type: 'divergence',
      status: 'pending',
      sourceRef: 'naming-0',
      title: 'Naming divergence',
      summary: sampleExpectedNamingDivergence.recommendation,
      divergence: sampleExpectedNamingDivergence,
      remindersSent: [],
    },
  ],
};

export const sampleApprovalRequestMixed: ApprovalRequestResponse = {
  ...sampleApprovalRequestPending,
  id: 'approval-002',
  status: 'open',
  items: [
    {
      ...sampleApprovalRequestPending.items[0]!,
      itemId: 'item-gap-approved',
      status: 'approved',
      decision: {
        action: 'approve',
        rationale: 'Accept gap remediation plan',
        resolvedAt: '2026-07-11T09:00:00.000Z',
        resolvedBy: 'user-001',
      },
    },
    {
      ...sampleApprovalRequestPending.items[1]!,
      itemId: 'item-gap-rejected',
      status: 'rejected',
      decision: {
        action: 'reject',
        rationale: 'Keep ticket wording',
        resolvedAt: '2026-07-11T09:05:00.000Z',
        resolvedBy: 'user-001',
      },
    },
    {
      ...sampleApprovalRequestPending.items[2]!,
      itemId: 'item-div-pending',
      status: 'pending',
    },
  ],
};

export const sampleApprovalRequestExpired: ApprovalRequestResponse = {
  ...sampleApprovalRequestPending,
  id: 'approval-003',
  status: 'blocked',
  expiresAt: '2026-07-10T08:00:00.000Z',
  items: sampleApprovalRequestPending.items.map((item) => ({
    ...item,
    status: 'expired' as const,
  })),
};
