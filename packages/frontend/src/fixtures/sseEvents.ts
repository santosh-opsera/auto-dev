import type { DomainEvent } from '@autodev/shared-types';
import {
  sampleChunkProgressEvent,
  samplePrCreatedEvent,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from '@autodev/shared-types';

/** DomainEvent fixtures matching shared-types schemas for frontend SSE tests. */
export const domainEventFixtures = {
  ticketParsed: sampleTicketParsedEvent,
  chunkProgress: sampleChunkProgressEvent,
  workflowTransitioned: sampleWorkflowTransitionedEvent,
  workflowFailed: sampleWorkflowFailedEvent,
  prCreated: samplePrCreatedEvent,
} as const satisfies Record<string, DomainEvent>;

export const mockSseDomainEvents: DomainEvent[] = Object.values(domainEventFixtures);

export function formatSseDataFrame(event: DomainEvent): string {
  return [
    `id: ${event.metadata.eventId}`,
    `event: ${event.type}`,
    `data: ${JSON.stringify(event)}`,
    '',
  ].join('\n');
}

export const mockSseStreamChunks = [
  'retry: 30000\n\n',
  ': heartbeat\n\n',
  ...mockSseDomainEvents.map((event) => `${formatSseDataFrame(event)}\n`),
];

export const mockSseStream = mockSseStreamChunks.join('');

export function parseSsePayload(payload: string): DomainEvent[] {
  const events: DomainEvent[] = [];
  const blocks = payload.split('\n\n').filter(Boolean);

  for (const block of blocks) {
    if (block.startsWith(':') || block.startsWith('retry:')) {
      continue;
    }

    const dataLine = block
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (!dataLine) {
      continue;
    }

    events.push(JSON.parse(dataLine.slice(6)) as DomainEvent);
  }

  return events;
}

export const parsedMockSseEvents = parseSsePayload(mockSseStream);
