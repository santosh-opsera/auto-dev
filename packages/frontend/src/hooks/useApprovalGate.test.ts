import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DomainEvent } from '@autodev/shared-types';
import * as approvalsApi from '../api/approvals';
import {
  mockApprovalStatusCleared,
  mockApprovalStatusPending,
  sampleApprovalRequestPending,
} from '../fixtures/approvals';
import { useApprovalGate } from './useApprovalGate';

describe('useApprovalGate', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('loads approval request and status', async () => {
    vi.spyOn(approvalsApi, 'fetchApprovalRequest').mockResolvedValue(sampleApprovalRequestPending);
    vi.spyOn(approvalsApi, 'fetchApprovalStatus').mockResolvedValue(mockApprovalStatusPending);

    const { result } = renderHook(() => useApprovalGate('approval-001'));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    expect(result.current.request?.id).toBe('approval-001');
    expect(result.current.gaps).toHaveLength(2);
    expect(result.current.divergences).toHaveLength(1);
    expect(result.current.canProceed).toBe(false);
    expect(result.current.totalCount).toBe(3);
  });

  it('resolves an item and refreshes status', async () => {
    vi.spyOn(approvalsApi, 'fetchApprovalRequest').mockResolvedValue(sampleApprovalRequestPending);
    vi.spyOn(approvalsApi, 'fetchApprovalStatus').mockResolvedValue(mockApprovalStatusPending);
    vi.spyOn(approvalsApi, 'resolveApprovalItem').mockResolvedValue({
      ...sampleApprovalRequestPending,
      items: sampleApprovalRequestPending.items.map((item) =>
        item.itemId === 'item-gap-001'
          ? {
              ...item,
              status: 'approved' as const,
              decision: {
                action: 'approve' as const,
                resolvedAt: '2026-07-11T09:00:00.000Z',
                resolvedBy: 'user-001',
              },
            }
          : item,
      ),
    });

    const { result } = renderHook(() => useApprovalGate('approval-001'));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    vi.spyOn(approvalsApi, 'fetchApprovalStatus').mockResolvedValue({
      ...mockApprovalStatusPending,
      resolvedCount: 1,
      pendingCount: 2,
    });

    let success = false;
    await act(async () => {
      success = await result.current.resolveItem('item-gap-001', { action: 'approve' });
    });

    expect(success).toBe(true);
    expect(approvalsApi.resolveApprovalItem).toHaveBeenCalledWith('approval-001', 'item-gap-001', {
      action: 'approve',
      rationale: undefined,
      modifiedValue: undefined,
    });
    expect(result.current.resolvedCount).toBe(1);
  });

  it('rejects resolve when validation fails', async () => {
    vi.spyOn(approvalsApi, 'fetchApprovalRequest').mockResolvedValue(sampleApprovalRequestPending);
    vi.spyOn(approvalsApi, 'fetchApprovalStatus').mockResolvedValue(mockApprovalStatusPending);
    const resolveSpy = vi.spyOn(approvalsApi, 'resolveApprovalItem');

    const { result } = renderHook(() => useApprovalGate('approval-001'));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    let success = true;
    await act(async () => {
      success = await result.current.resolveItem('item-gap-001', { action: 'reject' });
    });

    expect(success).toBe(false);
    expect(resolveSpy).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/Rationale is required/);
  });

  it('reloads on approval SSE events for matching request', async () => {
    const fetchRequest = vi
      .spyOn(approvalsApi, 'fetchApprovalRequest')
      .mockResolvedValue(sampleApprovalRequestPending);
    const fetchStatus = vi
      .spyOn(approvalsApi, 'fetchApprovalStatus')
      .mockResolvedValue(mockApprovalStatusPending);

    const { result } = renderHook(() => useApprovalGate('approval-001'));

    await waitFor(() => {
      expect(result.current.phase).toBe('ready');
    });

    fetchStatus.mockResolvedValue(mockApprovalStatusCleared);

    const event: DomainEvent = {
      type: 'APPROVAL_RESOLVED',
      payload: {
        ticketKey: 'OPL-4001',
        workflowId: 'workflow-approval-001',
        approvalId: 'approval-001',
        decision: 'approve',
        itemId: 'item-gap-001',
      },
      metadata: {
        eventId: 'evt-1',
        correlationId: 'corr-1',
        actor: 'user-001',
        userId: 'user-001',
        timestamp: '2026-07-11T09:00:00.000Z',
      },
    };

    await act(async () => {
      result.current.handleSseEvent(event);
    });

    await waitFor(() => {
      expect(result.current.canProceed).toBe(true);
    });

    expect(fetchRequest).toHaveBeenCalledTimes(2);
    expect(result.current.liveMessage).toMatch(/resolved/i);
  });
});
