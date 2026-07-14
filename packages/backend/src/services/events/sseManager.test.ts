import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { EventBus } from '@autodev/infrastructure';
import { SseManager } from './sseManager.js';
import { SSE_HEARTBEAT_INTERVAL_MS } from './sseFormatting.js';
import {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
} from '@autodev/shared-types';

function createMockResponse(): Response {
  const listeners = new Map<string, () => void>();

  return {
    writableEnded: false,
    destroyed: false,
    write: vi.fn().mockReturnValue(true),
    writeHead: vi.fn(),
    end: vi.fn(),
    on: vi.fn((event: string, listener: () => void) => {
      listeners.set(event, listener);
    }),
    emitClose: () => {
      listeners.get('close')?.();
    },
  } as unknown as Response;
}

describe('SseManager', () => {
  let manager: SseManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new SseManager();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes SSE headers and registers a connection', () => {
    const response = createMockResponse();

    manager.writeStreamHeaders(response);
    manager.registerConnection('user-1', response);

    expect(response.writeHead).toHaveBeenCalledWith(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    expect(response.write).toHaveBeenCalled();
    expect(manager.getConnectionCount('user-1')).toBe(1);
  });

  it('sends events only to the matching user', () => {
    const userOneResponse = createMockResponse();
    const userTwoResponse = createMockResponse();

    manager.registerConnection('user-1', userOneResponse);
    manager.registerConnection('user-2', userTwoResponse);

    manager.sendEventToUser('user-1', {
      ...sampleConventionUpdatedEvent,
      metadata: {
        ...sampleConventionUpdatedEvent.metadata,
        userId: 'user-1',
      },
    });

    expect(userOneResponse.write).toHaveBeenCalled();
    expect(userTwoResponse.write).not.toHaveBeenCalled();
  });

  it('bridges EventBus publishes to SSE connections for the event owner', async () => {
    const eventBus = new EventBus();
    const response = createMockResponse();
    manager.initializeEventBusBridge(eventBus);
    manager.registerConnection('user-1', response);

    await eventBus.publish({
      ...sampleChunkProgressEvent,
      metadata: {
        ...sampleChunkProgressEvent.metadata,
        userId: 'user-1',
      },
    });

    expect(response.write).toHaveBeenCalledWith(
      expect.stringContaining('event: CHUNK_PROGRESS'),
    );
  });

  it('emits heartbeat comments on the configured interval', () => {
    const response = createMockResponse();
    manager.registerConnection('user-1', response);
    const initialWriteCount = vi.mocked(response.write).mock.calls.length;

    vi.advanceTimersByTime(SSE_HEARTBEAT_INTERVAL_MS);

    expect(vi.mocked(response.write).mock.calls.length).toBeGreaterThan(initialWriteCount);
    expect(vi.mocked(response.write).mock.calls.at(-1)?.[0]).toBe(': heartbeat\n\n');
  });

  it('cleans up connections on close and logout', () => {
    const response = createMockResponse();
    manager.registerConnection('user-1', response);

    (response as Response & { emitClose: () => void }).emitClose();
    expect(manager.getConnectionCount('user-1')).toBe(0);

    const logoutResponse = createMockResponse();
    manager.registerConnection('user-1', logoutResponse);
    manager.closeUserConnections('user-1');

    expect(logoutResponse.end).toHaveBeenCalled();
    expect(manager.getConnectionCount('user-1')).toBe(0);
  });
});
