import { describe, expect, it } from 'vitest';
import {
  approvalCreateRequestSchema,
  approvalRequestResponseSchema,
  approvalResolveRequestSchema,
  approvalStatusResponseSchema,
} from './approval.js';
import {
  sampleApprovalRequestExpired,
  sampleApprovalRequestMixed,
  sampleApprovalRequestPending,
} from './fixtures/approval.js';

describe('approval schemas', () => {
  it('validates fixture approval requests', () => {
    expect(approvalRequestResponseSchema.safeParse(sampleApprovalRequestPending).success).toBe(
      true,
    );
    expect(approvalRequestResponseSchema.safeParse(sampleApprovalRequestMixed).success).toBe(true);
    expect(approvalRequestResponseSchema.safeParse(sampleApprovalRequestExpired).success).toBe(
      true,
    );
  });

  it('requires modifiedValue for modify actions', () => {
    expect(
      approvalResolveRequestSchema.safeParse({ action: 'modify', rationale: 'change it' }).success,
    ).toBe(false);
    expect(
      approvalResolveRequestSchema.safeParse({
        action: 'modify',
        modifiedValue: 'Use camelCase service naming',
      }).success,
    ).toBe(true);
  });

  it('validates create and status payloads', () => {
    expect(approvalCreateRequestSchema.safeParse({ workflowId: 'wf-1' }).success).toBe(true);
    expect(
      approvalStatusResponseSchema.safeParse({
        requestId: 'approval-001',
        ticketKey: 'OPL-4001',
        canProceed: false,
        pendingCount: 2,
        expiredCount: 0,
        resolvedCount: 1,
        totalCount: 3,
        status: 'open',
        expiresAt: '2026-07-14T08:00:00.000Z',
      }).success,
    ).toBe(true);
  });
});
