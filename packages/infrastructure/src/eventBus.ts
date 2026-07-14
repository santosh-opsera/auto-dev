import type {
  DomainEvent,
  DomainEventByType,
  EventType,
  PublishEventOptions,
} from '@autodev/shared-types';
import { domainEventSchema } from '@autodev/shared-types';
import { noopLogger, type Logger } from './logger.js';

export type EventHandler<T extends EventType = EventType> = (
  event: DomainEventByType<T>,
) => void | Promise<void>;

const MAX_EVENT_HISTORY = 100;

export class EventBus {
  private readonly handlers = new Map<EventType, Set<EventHandler>>();
  private readonly history: DomainEvent[] = [];
  private logger: Logger;

  constructor(logger: Logger = noopLogger) {
    this.logger = logger;
  }

  /** Wire the host application's logger (e.g. backend structured logger) at bootstrap. */
  setLogger(logger: Logger): void {
    this.logger = logger;
  }

  subscribe<T extends EventType>(eventType: T, handler: EventHandler<T>): void {
    const handlers = this.handlers.get(eventType) ?? new Set<EventHandler>();
    handlers.add(handler as unknown as EventHandler);
    this.handlers.set(eventType, handlers);
  }

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

  getHistory(): DomainEvent[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history.length = 0;
  }

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

export const eventBus = new EventBus();
