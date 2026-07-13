import { useCallback, useEffect, useState } from 'react';
import type {
  ApprovalAction,
  ApprovalItem,
  ApprovalRequestResponse,
  ApprovalStatusResponse,
  DomainEvent,
} from '@autodev/shared-types';
import {
  fetchApprovalRequest,
  fetchApprovalStatus,
  resolveApprovalItem,
} from '../api/approvals';
import { ApiError } from '../api/client';
import { validateApprovalDecision } from '../utils/approvalValidation';

export type ApprovalGatePhase = 'idle' | 'loading' | 'ready' | 'error';

export interface ResolveItemInput {
  action: ApprovalAction;
  rationale?: string;
  modifiedValue?: string;
}

export interface ApprovalGateState {
  phase: ApprovalGatePhase;
  request: ApprovalRequestResponse | null;
  status: ApprovalStatusResponse | null;
  error: string | null;
  resolvingItemId: string | null;
  liveMessage: string | null;
}

const initialState: ApprovalGateState = {
  phase: 'idle',
  request: null,
  status: null,
  error: null,
  resolvingItemId: null,
  liveMessage: null,
};

function groupItems(items: ApprovalItem[]): {
  gaps: ApprovalItem[];
  divergences: ApprovalItem[];
} {
  return {
    gaps: items.filter((item) => item.type === 'gap'),
    divergences: items.filter((item) => item.type === 'divergence'),
  };
}

export function useApprovalGate(requestId: string | undefined) {
  const [state, setState] = useState<ApprovalGateState>(initialState);

  const loadData = useCallback(async (id: string): Promise<void> => {
    setState((previous) => ({
      ...previous,
      phase: 'loading',
      error: null,
    }));

    try {
      const [request, status] = await Promise.all([
        fetchApprovalRequest(id),
        fetchApprovalStatus(id),
      ]);

      setState((previous) => ({
        ...previous,
        phase: 'ready',
        request,
        status,
        error: null,
      }));
    } catch (loadError) {
      const message =
        loadError instanceof ApiError
          ? [loadError.message, loadError.suggestedAction].filter(Boolean).join(' ')
          : loadError instanceof Error
            ? loadError.message
            : 'Failed to load approval request.';

      setState((previous) => ({
        ...previous,
        phase: 'error',
        error: message,
        request: null,
        status: null,
      }));
    }
  }, []);

  useEffect(() => {
    if (!requestId?.trim()) {
      setState(initialState);
      return;
    }

    void loadData(requestId.trim());
  }, [loadData, requestId]);

  const resolveItem = useCallback(
    async (itemId: string, input: ResolveItemInput): Promise<boolean> => {
      if (!requestId?.trim()) {
        return false;
      }

      const validationError = validateApprovalDecision(input);
      if (validationError) {
        setState((previous) => ({
          ...previous,
          error: Object.values(validationError).filter(Boolean).join(' '),
        }));
        return false;
      }

      setState((previous) => ({
        ...previous,
        resolvingItemId: itemId,
        error: null,
      }));

      try {
        const request = await resolveApprovalItem(requestId.trim(), itemId, {
          action: input.action,
          rationale: input.rationale?.trim() || undefined,
          modifiedValue: input.modifiedValue?.trim() || undefined,
        });
        const status = await fetchApprovalStatus(requestId.trim());

        setState((previous) => ({
          ...previous,
          phase: 'ready',
          request,
          status,
          resolvingItemId: null,
          liveMessage: `Item ${itemId} marked as ${input.action}.`,
          error: null,
        }));
        return true;
      } catch (resolveError) {
        const message =
          resolveError instanceof ApiError
            ? [resolveError.message, resolveError.suggestedAction].filter(Boolean).join(' ')
            : resolveError instanceof Error
              ? resolveError.message
              : 'Failed to resolve approval item.';

        setState((previous) => ({
          ...previous,
          resolvingItemId: null,
          error: message,
        }));
        return false;
      }
    },
    [requestId],
  );

  const handleSseEvent = useCallback(
    (event: DomainEvent) => {
      if (!requestId?.trim()) {
        return;
      }

      const approvalId =
        'approvalId' in event.payload ? event.payload.approvalId : undefined;

      if (
        event.type !== 'APPROVAL_REQUESTED' &&
        event.type !== 'APPROVAL_RESOLVED' &&
        event.type !== 'APPROVAL_EXPIRED' &&
        event.type !== 'APPROVAL_REMINDER'
      ) {
        return;
      }

      if (approvalId && approvalId !== requestId.trim()) {
        return;
      }

      const messages: Record<string, string> = {
        APPROVAL_REQUESTED: 'A new approval request was created.',
        APPROVAL_RESOLVED: 'An approval item was resolved.',
        APPROVAL_EXPIRED: 'One or more approval items expired.',
        APPROVAL_REMINDER: 'Approval reminder received.',
      };

      setState((previous) => ({
        ...previous,
        liveMessage: messages[event.type] ?? 'Approval status updated.',
      }));

      void loadData(requestId.trim());
    },
    [loadData, requestId],
  );

  const refresh = useCallback(async (): Promise<void> => {
    if (!requestId?.trim()) {
      return;
    }
    await loadData(requestId.trim());
  }, [loadData, requestId]);

  const grouped = state.request ? groupItems(state.request.items) : { gaps: [], divergences: [] };
  const resolvedCount = state.status?.resolvedCount ?? 0;
  const totalCount = state.status?.totalCount ?? state.request?.items.length ?? 0;
  const canProceed = state.status?.canProceed === true;
  const expiresAt = state.status?.expiresAt ?? state.request?.expiresAt ?? null;

  return {
    ...state,
    gaps: grouped.gaps,
    divergences: grouped.divergences,
    resolvedCount,
    totalCount,
    canProceed,
    expiresAt,
    resolveItem,
    handleSseEvent,
    refresh,
  };
}
