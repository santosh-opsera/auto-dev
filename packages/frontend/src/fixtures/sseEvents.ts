import type { DomainEvent } from '@autodev/shared-types';
import { sampleChunkProgressEvent } from '@autodev/shared-types';

export const mockSseStreamChunks = [
  'retry: 30000\n\n',
  ': heartbeat\n\n',
  `id: ${sampleChunkProgressEvent.metadata.eventId}\n`,
  `event: ${sampleChunkProgressEvent.type}\n`,
  `data: ${JSON.stringify(sampleChunkProgressEvent)}\n\n`,
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
