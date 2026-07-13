import { useEffect, useRef } from 'react';
import { domainEventSchema, type DomainEvent } from '@autodev/shared-types';

export const SSE_STREAM_PATH = '/api/v1/events/stream';
export const SSE_INITIAL_RETRY_MS = 1_000;
export const SSE_MAX_RETRY_MS = 30_000;

export interface UseSSEOptions {
  enabled: boolean;
  onEvent?: (event: DomainEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

function parseDomainEvent(raw: string): DomainEvent | null {
  try {
    return domainEventSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function getNextRetryDelay(attempt: number): number {
  const delay = SSE_INITIAL_RETRY_MS * 2 ** attempt;
  return Math.min(delay, SSE_MAX_RETRY_MS);
}

export function createSseEventSource(url: string): EventSource {
  return new EventSource(url, { withCredentials: true });
}

export function useSSE({ enabled, onEvent, onConnectionChange }: UseSSEOptions): void {
  const onEventRef = useRef(onEvent);
  const onConnectionChangeRef = useRef(onConnectionChange);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onConnectionChangeRef.current = onConnectionChange;
  }, [onConnectionChange]);

  useEffect(() => {
    if (!enabled) {
      onConnectionChangeRef.current?.(false);
      return undefined;
    }

    let disposed = false;
    let reconnectAttempt = 0;
    let reconnectTimer: number | null = null;
    let eventSource: EventSource | null = null;

    const clearReconnectTimer = (): void => {
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
    };

    const connect = (): void => {
      if (disposed) {
        return;
      }

      eventSource?.close();
      eventSource = createSseEventSource(SSE_STREAM_PATH);

      eventSource.onopen = () => {
        reconnectAttempt = 0;
        onConnectionChangeRef.current?.(true);
      };

      eventSource.onmessage = (message) => {
        const event = parseDomainEvent(message.data);
        if (event) {
          onEventRef.current?.(event);
        }
      };

      eventSource.onerror = () => {
        onConnectionChangeRef.current?.(false);
        eventSource?.close();

        if (disposed) {
          return;
        }

        const delay = getNextRetryDelay(reconnectAttempt);
        reconnectAttempt += 1;
        clearReconnectTimer();
        reconnectTimer = window.setTimeout(connect, delay);
      };

      for (const eventType of [
        'TICKET_PARSED',
        'ANALYSIS_STARTED',
        'ANALYSIS_COMPLETED',
        'DIVERGENCE_DETECTED',
        'DIVERGENCE_NONE',
        'APPROVAL_REQUESTED',
        'APPROVAL_RESOLVED',
        'APPROVAL_EXPIRED',
        'APPROVAL_REMINDER',
        'CONVENTION_UPDATED',
        'CHUNK_PROGRESS',
        'WORKFLOW_TRANSITIONED',
        'WORKFLOW_FAILED',
      ] as const) {
        eventSource.addEventListener(eventType, (message) => {
          const event = parseDomainEvent((message as MessageEvent<string>).data);
          if (event) {
            onEventRef.current?.(event);
          }
        });
      }
    };

    connect();

    return () => {
      disposed = true;
      clearReconnectTimer();
      eventSource?.close();
      onConnectionChangeRef.current?.(false);
    };
  }, [enabled]);
}
