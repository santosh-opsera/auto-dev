import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { sampleChunkProgressEvent } from '@autodev/shared-types';
import {
  domainEventFixtures,
  mockSseStream,
  parseSsePayload,
} from '../fixtures/sseEvents';
import { getNextRetryDelay, SSE_MAX_RETRY_MS, useSSE } from './useSSE';

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();
  closed = false;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      if (!this.closed) {
        this.onopen?.();
      }
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  }

  close(): void {
    this.closed = true;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.listeners.clear();
  }

  emit(type: string, data: string): void {
    if (this.closed) {
      return;
    }

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
    if (this.closed) {
      return;
    }
    this.onerror?.();
  }
}

describe('useSSE helpers', () => {
  it('parses mock SSE stream fixtures for DomainEvent payloads', () => {
    const events = parseSsePayload(mockSseStream);

    expect(events.length).toBeGreaterThanOrEqual(3);
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        domainEventFixtures.ticketParsed.type,
        domainEventFixtures.chunkProgress.type,
        domainEventFixtures.workflowTransitioned.type,
      ]),
    );
  });

  it('uses exponential backoff delays 1s, 2s, 4s, 8s, 16s, then caps at 30s', () => {
    expect(getNextRetryDelay(0)).toBe(1_000);
    expect(getNextRetryDelay(1)).toBe(2_000);
    expect(getNextRetryDelay(2)).toBe(4_000);
    expect(getNextRetryDelay(3)).toBe(8_000);
    expect(getNextRetryDelay(4)).toBe(16_000);
    expect(getNextRetryDelay(5)).toBe(SSE_MAX_RETRY_MS);
    expect(getNextRetryDelay(10)).toBe(SSE_MAX_RETRY_MS);
  });
});

describe('useSSE', () => {
  afterEach(() => {
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('creates an EventSource when enabled (auth)', async () => {
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    renderHook(() => useSSE({ enabled: true }));

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });
    expect(MockEventSource.instances[0]?.closed).toBe(false);
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

  it('tears down immediately when disabled (logout) and does not reconnect', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSSE({ enabled }),
      { initialProps: { enabled: true } },
    );

    await vi.waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const source = MockEventSource.instances[0]!;
    expect(source.closed).toBe(false);

    rerender({ enabled: false });

    expect(source.closed).toBe(true);

    source.emitError();
    await vi.advanceTimersByTimeAsync(30_000);

    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('tears down on session expiry (enabled flips false) with no further reconnects', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    const { rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) => useSSE({ enabled }),
      { initialProps: { enabled: true } },
    );

    await vi.waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const source = MockEventSource.instances[0]!;
    rerender({ enabled: false });
    expect(source.closed).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('reconnects with exponential backoff after connection errors', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);

    renderHook(() => useSSE({ enabled: true }));

    await vi.waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    MockEventSource.instances[0]?.emitError();
    await vi.advanceTimersByTimeAsync(999);
    expect(MockEventSource.instances).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(MockEventSource.instances).toHaveLength(2);

    MockEventSource.instances[1]?.emitError();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(MockEventSource.instances).toHaveLength(3);

    MockEventSource.instances[2]?.emitError();
    await vi.advanceTimersByTimeAsync(4_000);
    expect(MockEventSource.instances).toHaveLength(4);
  });

  it('does not open a second connection while remaining enabled', async () => {
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    const onEvent = vi.fn();

    const { rerender } = renderHook(
      ({ onEvent }: { onEvent: (event: unknown) => void }) =>
        useSSE({ enabled: true, onEvent }),
      { initialProps: { onEvent } },
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const nextOnEvent = vi.fn();
    rerender({ onEvent: nextOnEvent });

    expect(MockEventSource.instances).toHaveLength(1);

    act(() => {
      MockEventSource.instances[0]?.emit(
        'CHUNK_PROGRESS',
        JSON.stringify(sampleChunkProgressEvent),
      );
    });

    expect(nextOnEvent).toHaveBeenCalledWith(sampleChunkProgressEvent);
    expect(onEvent).not.toHaveBeenCalled();
  });
});
