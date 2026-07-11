import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { sampleChunkProgressEvent } from '@autodev/shared-types';
import { mockSseStream, parseSsePayload } from '../fixtures/sseEvents';
import { getNextRetryDelay, useSSE } from './useSSE';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  }

  close(): void {
    // no-op
  }

  emit(type: string, data: string): void {
    const event = { data } as MessageEvent<string>;
    if (type === 'message') {
      this.onmessage?.(event);
      return;
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitError(): void {
    this.onerror?.();
  }
}

describe('useSSE helpers', () => {
  it('parses mock SSE stream fixtures', () => {
    const events = parseSsePayload(mockSseStream);

    expect(events).toHaveLength(1);
    expect(events[0]?.type).toBe('CHUNK_PROGRESS');
  });

  it('uses exponential backoff delays capped at 30 seconds', () => {
    expect(getNextRetryDelay(0)).toBe(1_000);
    expect(getNextRetryDelay(1)).toBe(2_000);
    expect(getNextRetryDelay(4)).toBe(16_000);
    expect(getNextRetryDelay(10)).toBe(30_000);
  });
});

describe('useSSE', () => {
  afterEach(() => {
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('connects when enabled and forwards parsed domain events', async () => {
    const onEvent = vi.fn();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    renderHook(() => useSSE({ enabled: true, onEvent }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0]?.emit(
      'CHUNK_PROGRESS',
      JSON.stringify(sampleChunkProgressEvent),
    );

    expect(onEvent).toHaveBeenCalledWith(sampleChunkProgressEvent);
  });

  it('reconnects with exponential backoff after connection errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    renderHook(() => useSSE({ enabled: true }));

    await vi.waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0]?.emitError();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(MockEventSource.instances).toHaveLength(2);
  });
});
