import type { Response } from 'express';
import { EVENT_TYPES, type DomainEvent } from '@autodev/shared-types';
import { logger } from '../../utils/logger.js';
import type { EventBus } from './eventBus.js';
import {
  formatSseEvent,
  formatSseHeartbeat,
  formatSseRetry,
  SSE_HEARTBEAT_INTERVAL_MS,
} from './sseFormatting.js';

interface SseConnection {
  userId: string;
  response: Response;
  heartbeatTimer: NodeJS.Timeout;
}

export class SseManager {
  private readonly connections = new Map<string, Set<SseConnection>>();
  private bridgeInitialized = false;

  registerConnection(userId: string, response: Response): void {
    const heartbeatTimer = setInterval(() => {
      this.writeToConnection(response, formatSseHeartbeat());
    }, SSE_HEARTBEAT_INTERVAL_MS);

    const connection: SseConnection = {
      userId,
      response,
      heartbeatTimer,
    };

    const userConnections = this.connections.get(userId) ?? new Set<SseConnection>();
    userConnections.add(connection);
    this.connections.set(userId, userConnections);

    response.on('close', () => {
      this.removeConnection(userId, connection);
    });
  }

  removeConnection(userId: string, connection: SseConnection): void {
    clearInterval(connection.heartbeatTimer);

    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return;
    }

    userConnections.delete(connection);
    if (userConnections.size === 0) {
      this.connections.delete(userId);
    }
  }

  closeUserConnections(userId: string): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections) {
      return;
    }

    for (const connection of [...userConnections]) {
      clearInterval(connection.heartbeatTimer);
      connection.response.end();
      userConnections.delete(connection);
    }

    this.connections.delete(userId);
  }

  closeAllConnections(): void {
    for (const userId of [...this.connections.keys()]) {
      this.closeUserConnections(userId);
    }
  }

  sendEventToUser(userId: string, event: DomainEvent): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return;
    }

    const payload = formatSseEvent(event);
    for (const connection of userConnections) {
      this.writeToConnection(connection.response, payload);
    }
  }

  initializeEventBusBridge(eventBus: EventBus): void {
    if (this.bridgeInitialized) {
      return;
    }

    for (const eventType of EVENT_TYPES) {
      eventBus.subscribe(eventType, (event) => {
        this.sendEventToUser(event.metadata.userId, event);
      });
    }

    this.bridgeInitialized = true;
  }

  writeStreamHeaders(response: Response): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(formatSseRetry(SSE_HEARTBEAT_INTERVAL_MS));
    response.write(formatSseHeartbeat());
  }

  getConnectionCount(userId?: string): number {
    if (userId) {
      return this.connections.get(userId)?.size ?? 0;
    }

    let total = 0;
    for (const userConnections of this.connections.values()) {
      total += userConnections.size;
    }
    return total;
  }

  private writeToConnection(response: Response, payload: string): void {
    if (response.writableEnded || response.destroyed) {
      return;
    }

    try {
      response.write(payload);
    } catch (error) {
      logger.error('Failed to write SSE payload', {
        resource: 'sse-manager',
        operation: 'write',
      });
      if (error instanceof Error) {
        logger.error(error.message, {
          resource: 'sse-manager',
          operation: 'write',
        });
      }
    }
  }
}

export const sseManager = new SseManager();
