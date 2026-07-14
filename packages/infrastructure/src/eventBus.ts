import type {
  DomainEvent,
  DomainEventByType,
  EventType,
  PublishEventOptions,
} from '@autodev/shared-types';
import { domainEventSchema } from '@autodev/shared-types';
import { noopLogger, type Logger } from './logger.js';

/** Handler for a typed {@link DomainEvent}. */
export type EventHandler<T extends EventType = EventType> = (
  event: DomainEventByType<T>,
) => void | Promise<void>;

const MAX_EVENT_HISTORY = 100;

/**
 * In-process typed pub/sub for domain events (Zod-validated via shared-types).
 * Handler failures are isolated and logged through the injected {@link Logger}.
 */
export class EventBus {
  private readonly handlers = new Map<EventType, Set<EventHandler>>();
  private readonly history: DomainEvent[] = [];
  private logger: Logger;

  /** @param logger - Logger used when handlers throw (default {@link noopLogger}) */
  constructor(logger: Logger = noopLogger) {
    this.logger = logger;
  }

  /** Wire the host application's logger (e.g. backend structured logger) at bootstrap. */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  /** Register a handler for `eventType`. */
  subscribe<T extends EventType>(eventType: T, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler as unknown as EventHandler);
    this.handlers.set(eventType, handlers);
  }

  /** Remove a previously registered handler. */
  unsubscribe<T extends EventType>(eventType: T, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType);
    if (!handlers) {
      return;
    }

    handlers.delete(handler as unknown as EventHandler);
    if (handlers.size === 0) {
      this.handlers.delete(eventType);
    }
  }

  /**
   * Validate and dispatch an event to subscribers.
   * @param event - Domain event payload
   * @param options - When `awaitHandlers` is true, wait for all handlers
   */
  async publish(event: DomainEvent, options?: PublishEventOptions): Promise<void> {
    const validated = domainEventSchema.parse(event);
    this.recordHistory(validated);

    const handlers = this.handlers.get(validated.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const dispatch = [...handlers].map((handler) => this.invokeHandler(validated, handler));

    if (options?.awaitHandlers) {
      await Promise.all(dispatch);
      return;
    }

    void Promise.all(dispatch);
  }

  /** Snapshot of the last up to 100 published events. */
  getHistory(): DomainEvent[] {
    return [...this.history];
  }

  /** Clear the in-memory event history buffer. */
  clearHistory(): void {
    this.history.length = 0;
  }

  /** Remove all subscriptions (primarily for tests). */
  clearSubscriptions(): void {
    this.handlers.clear();
  }

  private recordHistory(event: DomainEvent): void {
    this.history.push(event);
    if (this.history.length > MAX_EVENT_HISTORY) {
      this.history.shift();
    }
  }

  private async invokeHandler(event: DomainEvent, handler: EventHandler): Promise<void> {
    try {
      await handler(event);
    } catch (error) {
      this.logger.error('Event handler failed', {
        resource: 'event-bus',
        operation: event.type,
        actor: event.metadata.actor,
      });
      if (error instanceof Error) {
        this.logger.error(error.message, {
          resource: 'event-bus',
          operation: 'handler',
          actor: event.metadata.actor,
        });
      }
    }
  }
}

/** Process-wide {@link EventBus} singleton used by backend services. */
export const eventBus = new EventBus();
