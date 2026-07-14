import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventBus } from './eventBus.js';
import {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleTicketParsedEvent,
} from '../../fixtures/events.js';
import { parseLogLine, resetLogWriter, setLogWriter } from '../../utils/logger.js';

describe('EventBus', () => {
  let bus: EventBus;
  const logLines: string[] = [];

  beforeEach(() => {
    bus = new EventBus();
    logLines.length = 0;
    setLogWriter((line, level) => {
      if (level === 'error') {
        logLines.push(line);
      }
    });
  });

  afterEach(() => {
    resetLogWriter();
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
    expect(logLines.some((line) => parseLogLine(line).message === 'Event handler failed')).toBe(
      true,
    );
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
