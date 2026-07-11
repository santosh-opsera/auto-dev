import { describe, expect, it } from 'vitest';
import { sampleChunkProgressEvent } from '@autodev/shared-types';
import {
  formatSseEvent,
  formatSseHeartbeat,
  formatSseRetry,
  SSE_HEARTBEAT_INTERVAL_MS,
} from './sseFormatting.js';

describe('sseFormatting', () => {
  it('formats domain events with id, event type, and JSON data', () => {
    const formatted = formatSseEvent(sampleChunkProgressEvent);

    expect(formatted).toContain(`id: ${sampleChunkProgressEvent.metadata.eventId}`);
    expect(formatted).toContain('event: CHUNK_PROGRESS');
    expect(formatted).toContain(`data: ${JSON.stringify(sampleChunkProgressEvent)}`);
    expect(formatted.endsWith('\n\n')).toBe(true);
  });

  it('formats heartbeat comments', () => {
    expect(formatSseHeartbeat()).toBe(': heartbeat\n\n');
  });

  it('formats retry directives', () => {
    expect(formatSseRetry(SSE_HEARTBEAT_INTERVAL_MS)).toBe('retry: 30000\n\n');
  });
});
