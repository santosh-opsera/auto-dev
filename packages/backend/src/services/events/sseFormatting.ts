import type { DomainEvent } from '@autodev/shared-types';

export const SSE_HEARTBEAT_INTERVAL_MS = 30_000;

export function formatSseEvent(event: DomainEvent): string {
  return `id: ${event.metadata.eventId}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function formatSseHeartbeat(): string {
  return ': heartbeat\n\n';
}

export function formatSseRetry(milliseconds: number): string {
  return `retry: ${milliseconds}\n\n`;
}
