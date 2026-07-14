import type { DomainEvent } from '@autodev/shared-types';

export type SseEventListener = (event: DomainEvent) => void;

const listeners = new Set<SseEventListener>();

export function subscribeSSE(listener: SseEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifySSEListeners(event: DomainEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function clearSSEListeners(): void {
  listeners.clear();
}

export function getSSEListenerCount(): number {
  return listeners.size;
}
