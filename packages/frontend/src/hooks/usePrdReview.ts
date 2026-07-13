import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PrdResponse, PrdSections } from '@autodev/shared-types';
import {
  approvePrd,
  createPrdVersion,
  fetchLatestPrdForTicket,
  fetchPrdById,
  fetchPrdVersionHistory,
  rejectPrd,
} from '../api/prd';
import { ApiError } from '../api/client';

function sanitizeDraftSections(sections: PrdSections): PrdSections {
  return {
    problemStatement: sections.problemStatement.trim(),
    solutionOutline: sections.solutionOutline.trim(),
    userStories: sanitizeList(sections.userStories),
    acceptanceCriteria: sanitizeList(sections.acceptanceCriteria),
    scopeBoundaries: sanitizeList(sections.scopeBoundaries),
    dependencies: sanitizeList(sections.dependencies),
    risks: sanitizeList(sections.risks),
    successMetrics: sanitizeList(sections.successMetrics),
  };
}

function sanitizeList(values: string[]): string[] {
  const cleaned = values.map((line) => line.trim()).filter((line) => line.length > 0);
  return cleaned.length > 0 ? cleaned : [''];
}

export type PrdReviewPhase = 'idle' | 'loading' | 'ready' | 'error';
export type PrdReviewTab = 'content' | 'history';

export interface PrdReviewLookup {
  prdId?: string;
  ticketKey?: string;
}

export interface PrdReviewState {
  phase: PrdReviewPhase;
  prd: PrdResponse | null;
  history: PrdResponse[];
  error: string | null;
  liveMessage: string | null;
  isEditing: boolean;
  draftSections: PrdSections | null;
  isSaving: boolean;
  isApproving: boolean;
  isRejecting: boolean;
  activeTab: PrdReviewTab;
  compareFromId: string | null;
  compareToId: string | null;
}

const initialState: PrdReviewState = {
  phase: 'idle',
  prd: null,
  history: [],
  error: null,
  liveMessage: null,
  isEditing: false,
  draftSections: null,
  isSaving: false,
  isApproving: false,
  isRejecting: false,
  activeTab: 'content',
  compareFromId: null,
  compareToId: null,
};

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return [error.message, error.suggestedAction].filter(Boolean).join(' ');
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}

export function usePrdReview(lookup: PrdReviewLookup) {
  const [state, setState] = useState<PrdReviewState>(initialState);

  const loadData = useCallback(async (next: PrdReviewLookup): Promise<void> => {
    setState((previous) => ({
      ...previous,
      phase: 'loading',
      error: null,
    }));

    try {
      const prd = next.prdId
        ? await fetchPrdById(next.prdId)
        : next.ticketKey
          ? await fetchLatestPrdForTicket(next.ticketKey)
          : null;

      if (!prd) {
        setState({
          ...initialState,
          phase: 'error',
          error: 'Provide a PRD id or ticket key to load a review.',
        });
        return;
      }

      const historyResponse = await fetchPrdVersionHistory(prd.ticketKey);
      const history = historyResponse.prds;
      const compareToId = prd.id;
      const compareFromId =
        history.find((entry) => entry.id === prd.previousVersionId)?.id ??
        history.find((entry) => entry.id !== prd.id)?.id ??
        null;

      setState((previous) => ({
        ...previous,
        phase: 'ready',
        prd,
        history,
        error: null,
        isEditing: false,
        draftSections: null,
        compareFromId,
        compareToId,
        liveMessage: `Loaded PRD version ${prd.version} for ${prd.ticketKey}.`,
      }));
    } catch (loadError) {
      setState((previous) => ({
        ...previous,
        phase: 'error',
        error: toErrorMessage(loadError, 'Failed to load PRD.'),
        prd: null,
        history: [],
      }));
    }
  }, []);

  useEffect(() => {
    if (!lookup.prdId?.trim() && !lookup.ticketKey?.trim()) {
      setState(initialState);
      return;
    }

    void loadData({
      prdId: lookup.prdId?.trim() || undefined,
      ticketKey: lookup.ticketKey?.trim() || undefined,
    });
  }, [loadData, lookup.prdId, lookup.ticketKey]);

  const startEditing = useCallback((): void => {
    setState((previous) => {
      if (!previous.prd || previous.prd.status === 'approved') {
        return previous;
      }
      return {
        ...previous,
        isEditing: true,
        draftSections: structuredClone(previous.prd.sections),
        activeTab: 'content',
        liveMessage: 'Editing PRD sections. Save creates a new version.',
      };
    });
  }, []);

  const cancelEditing = useCallback((): void => {
    setState((previous) => ({
      ...previous,
      isEditing: false,
      draftSections: null,
      liveMessage: 'Edit cancelled.',
    }));
  }, []);

  const updateDraftSection = useCallback(
    (key: keyof PrdSections, value: string | string[]): void => {
      setState((previous) => {
        if (!previous.draftSections) {
          return previous;
        }
        return {
          ...previous,
          draftSections: {
            ...previous.draftSections,
            [key]: value,
          },
        };
      });
    },
    [],
  );

  const saveVersion = useCallback(async (): Promise<boolean> => {
    if (!state.prd || !state.draftSections) {
      return false;
    }

    setState((previous) => ({ ...previous, isSaving: true, error: null }));

    try {
      const updated = await createPrdVersion(state.prd.id, {
        sections: sanitizeDraftSections(state.draftSections),
        status: 'in_review',
      });
      const historyResponse = await fetchPrdVersionHistory(updated.ticketKey);

      setState((previous) => ({
        ...previous,
        isSaving: false,
        isEditing: false,
        draftSections: null,
        prd: updated,
        history: historyResponse.prds,
        compareToId: updated.id,
        compareFromId: updated.previousVersionId ?? previous.compareFromId,
        liveMessage: `Saved PRD version ${updated.version}.`,
      }));
      return true;
    } catch (saveError) {
      setState((previous) => ({
        ...previous,
        isSaving: false,
        error: toErrorMessage(saveError, 'Failed to save PRD version.'),
      }));
      return false;
    }
  }, [state.draftSections, state.prd]);

  const approve = useCallback(async (): Promise<boolean> => {
    if (!state.prd) {
      return false;
    }

    setState((previous) => ({ ...previous, isApproving: true, error: null }));

    try {
      const updated = await approvePrd(state.prd.id);
      setState((previous) => ({
        ...previous,
        isApproving: false,
        prd: updated,
        history: previous.history.map((entry) =>
          entry.id === updated.id ? updated : entry,
        ),
        isEditing: false,
        draftSections: null,
        liveMessage: `PRD version ${updated.version} approved.`,
      }));
      return true;
    } catch (approveError) {
      setState((previous) => ({
        ...previous,
        isApproving: false,
        error: toErrorMessage(approveError, 'Failed to approve PRD.'),
      }));
      return false;
    }
  }, [state.prd]);

  const reject = useCallback(
    async (reason: string): Promise<boolean> => {
      if (!state.prd) {
        return false;
      }

      const trimmed = reason.trim();
      if (!trimmed) {
        setState((previous) => ({
          ...previous,
          error: 'A rejection reason is required.',
          liveMessage: 'Rejection blocked: reason required.',
        }));
        return false;
      }

      setState((previous) => ({ ...previous, isRejecting: true, error: null }));

      try {
        const updated = await rejectPrd(state.prd.id, { reason: trimmed });
        setState((previous) => ({
          ...previous,
          isRejecting: false,
          prd: updated,
          history: previous.history.map((entry) =>
            entry.id === updated.id ? updated : entry,
          ),
          isEditing: false,
          draftSections: null,
          liveMessage: `PRD version ${updated.version} rejected and marked for regeneration.`,
        }));
        return true;
      } catch (rejectError) {
        setState((previous) => ({
          ...previous,
          isRejecting: false,
          error: toErrorMessage(rejectError, 'Failed to reject PRD.'),
        }));
        return false;
      }
    },
    [state.prd],
  );

  const setActiveTab = useCallback((tab: PrdReviewTab): void => {
    setState((previous) => ({ ...previous, activeTab: tab }));
  }, []);

  const setCompareSelection = useCallback((fromId: string | null, toId: string | null): void => {
    setState((previous) => ({
      ...previous,
      compareFromId: fromId,
      compareToId: toId,
    }));
  }, []);

  const compareFrom = useMemo(
    () => state.history.find((entry) => entry.id === state.compareFromId) ?? null,
    [state.compareFromId, state.history],
  );

  const compareTo = useMemo(
    () => state.history.find((entry) => entry.id === state.compareToId) ?? null,
    [state.compareToId, state.history],
  );

  const canEdit = Boolean(state.prd && state.prd.status !== 'approved');
  const canApprove = Boolean(
    state.prd && (state.prd.status === 'draft' || state.prd.status === 'in_review'),
  );
  const canReject = Boolean(
    state.prd && state.prd.status !== 'approved' && state.prd.status !== 'rejected',
  );

  return {
    ...state,
    compareFrom,
    compareTo,
    canEdit,
    canApprove,
    canReject,
    startEditing,
    cancelEditing,
    updateDraftSection,
    saveVersion,
    approve,
    reject,
    setActiveTab,
    setCompareSelection,
    refresh: () =>
      void loadData({
        prdId: lookup.prdId?.trim() || state.prd?.id,
        ticketKey: lookup.ticketKey?.trim() || state.prd?.ticketKey,
      }),
  };
}
