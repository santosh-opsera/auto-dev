import { useCallback, useState } from 'react';
import type { GapItem, TicketIntent, TicketParseResponse, TicketResponse } from '@autodev/shared-types';
import { fetchTicket, parseTicket } from '../api/tickets';
import { ApiError } from '../api/client';

export type TicketIngestionPhase =
  | 'idle'
  | 'fetching'
  | 'parsing'
  | 'complete'
  | 'error';

export interface TicketIngestionState {
  phase: TicketIngestionPhase;
  ticketKey: string | null;
  ticket: TicketResponse | null;
  parseResult: TicketParseResponse | null;
  error: string | null;
  errorCode: string | null;
  progressMessage: string | null;
}

const initialState: TicketIngestionState = {
  phase: 'idle',
  ticketKey: null,
  ticket: null,
  parseResult: null,
  error: null,
  errorCode: null,
  progressMessage: null,
};

export function useTicketIngestion() {
  const [state, setState] = useState<TicketIngestionState>(initialState);
  const [resolvedGapFields, setResolvedGapFields] = useState<string[]>([]);
  const [localIntentOverrides, setLocalIntentOverrides] = useState<Partial<TicketIntent>>({});

  const reset = useCallback(() => {
    setState(initialState);
    setResolvedGapFields([]);
    setLocalIntentOverrides({});
  }, []);

  const ingestTicket = useCallback(async (ticketKey: string): Promise<void> => {
    const trimmedKey = ticketKey.trim();
    setState({
      phase: 'fetching',
      ticketKey: trimmedKey,
      ticket: null,
      parseResult: null,
      error: null,
      errorCode: null,
      progressMessage: 'Fetching ticket from Jira…',
    });

    try {
      const ticket = await fetchTicket(trimmedKey);

      setState((previous) => ({
        ...previous,
        phase: 'parsing',
        ticket,
        progressMessage: 'Parsing ticket and detecting gaps…',
      }));

      const parseResult = await parseTicket(trimmedKey);

      setState((previous) => ({
        ...previous,
        phase: 'complete',
        parseResult,
        progressMessage: null,
      }));
    } catch (loadError) {
      const message =
        loadError instanceof ApiError
          ? [loadError.message, loadError.suggestedAction].filter(Boolean).join(' ')
          : loadError instanceof Error
            ? loadError.message
            : 'Failed to ingest ticket.';
      const code = loadError instanceof ApiError ? (loadError.errorCode ?? null) : null;

      setState((previous) => ({
        ...previous,
        phase: 'error',
        error: message,
        errorCode: code,
        progressMessage: null,
      }));
    }
  }, []);

  const retry = useCallback(async (): Promise<void> => {
    if (!state.ticketKey) {
      return;
    }
    await ingestTicket(state.ticketKey);
  }, [ingestTicket, state.ticketKey]);

  const handleSseProgress = useCallback((ticketKey: string, message: string) => {
    setState((previous) => {
      if (previous.ticketKey !== ticketKey || previous.phase !== 'parsing') {
        return previous;
      }
      return { ...previous, progressMessage: message };
    });
  }, []);

  const resolveGap = useCallback((gap: GapItem, value: string) => {
    if (gap.field === 'acceptanceCriteria' && value.trim()) {
      const criteria = value
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      setLocalIntentOverrides((previous) => ({
        ...previous,
        acceptanceCriteria: criteria,
      }));
      setResolvedGapFields((previous) => [...previous, gap.field]);
    }
  }, []);

  const displayIntent: TicketIntent | null = state.parseResult
    ? { ...state.parseResult.intent, ...localIntentOverrides }
    : null;

  const displayGaps = state.parseResult
    ? state.parseResult.gaps.filter((gap) => !resolvedGapFields.includes(gap.field))
    : [];

  const canProceed =
    state.parseResult !== null &&
    (state.parseResult.canProceedToAnalysis || displayGaps.every((gap) => gap.severity !== 'critical'));

  return {
    ...state,
    displayIntent,
    displayGaps,
    canProceed,
    ingestTicket,
    retry,
    reset,
    handleSseProgress,
    resolveGap,
  };
}
