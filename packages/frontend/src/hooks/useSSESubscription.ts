import { useEffect, useRef } from 'react';
import type { DomainEvent } from '@autodev/shared-types';
import { subscribeSSE } from './sseEventBus';

/**
 * Subscribe to domain events from the single SSE connection owned by ProtectedRoute.
 * Does not open an EventSource — use this instead of useSSE on page components.
 */
export function useSSESubscription(
  onEvent: (event: DomainEvent) => void,
  enabled = true,
): void {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    return subscribeSSE((event) => {
      onEventRef.current(event);
    });
  }, [enabled]);
}
