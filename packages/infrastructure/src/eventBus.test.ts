import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleTicketParsedEvent,
} from '@autodev/shared-types';
import { EventBus } from './eventBus.js';
import type { Logger } from './logger.js';

describe('EventBus', () => {
  let bus: EventBus;
  const errorMessages: string[] = [];

  const captureLogger: Logger = {
    info() {},
    warn() {},
    error(message: string) {
      errorMessages.push(message);
    },
  };

  beforeEach(() => {
    bus = new EventBus(captureLogger);
    errorMessages.length = 0;
  });

  afterEach(() => {
    bus.clearSubscriptions();
    bus.clearHistory();
  });

  it('delivers published events to subscribed handlers', async () => {
    const handler = vi.fn();
    bus.subscribe('CONVENTION_UPDATED', handler);

    await bus.publish(sampleConventionUpdatedEvent, { awaitHandlers: true });

    expect(handler).toHaveBeenCalledWith(sampleConventionUpdatedEvent);
  });

  it('supports unsubscribing handlers', async () => {
    const handler = vi.fn();
    bus.subscribe('CHUNK_PROGRESS', handler);
    bus.unsubscribe('CHUNK_PROGRESS', handler);

    await bus.publish(sampleChunkProgressEvent, { awaitHandlers: true });

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler failures without blocking other handlers', async () => {
    const failingHandler = vi.fn(async () => {
      throw new Error('handler failed');
    });
    const succeedingHandler = vi.fn();

    bus.subscribe('TICKET_PARSED', failingHandler);
    bus.subscribe('TICKET_PARSED', succeedingHandler);

    await bus.publish(sampleTicketParsedEvent, { awaitHandlers: true });

    expect(failingHandler).toHaveBeenCalled();
    expect(succeedingHandler).toHaveBeenCalled();
    expect(errorMessages).toContain('Event handler failed');
  });

  it('awaits async handlers when awaitHandlers is true', async () => {
    const order: string[] = [];
    bus.subscribe('CONVENTION_UPDATED', async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      order.push('handler');
    });

    await bus.publish(sampleConventionUpdatedEvent, { awaitHandlers: true });
    order.push('after-publish');

    expect(order).toEqual(['handler', 'after-publish']);
  });

  it('keeps a circular buffer of the last 100 events', async () => {
    for (let index = 0; index < 105; index += 1) {
      await bus.publish(
        {
          ...sampleChunkProgressEvent,
          metadata: {
            ...sampleChunkProgressEvent.metadata,
            eventId: `event-${index}`,
          },
          payload: {
            ...sampleChunkProgressEvent.payload,
            progressPercent: index % 101,
          },
        } as typeof sampleChunkProgressEvent,
        { awaitHandlers: true },
      );
    }

    const history = bus.getHistory();
    expect(history).toHaveLength(100);
    expect(history[0]?.metadata.eventId).toBe('event-5');
    expect(history[history.length - 1]?.metadata.eventId).toBe('event-104');
  });
});
