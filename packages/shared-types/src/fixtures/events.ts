import type { DomainEvent } from './events.js';

export const sampleEventMetadata = {
  eventId: 'event-001',
  correlationId: 'corr-event-001',
  actor: 'user-001',
  userId: 'user-001',
  timestamp: '2026-07-11T08:00:00.000Z',
};

export const sampleConventionUpdatedEvent: DomainEvent = {
  type: 'CONVENTION_UPDATED',
  payload: {
    settingsId: 'settings-001',
    version: 2,
  },
  metadata: sampleEventMetadata,
};

export const sampleChunkProgressEvent: DomainEvent = {
  type: 'CHUNK_PROGRESS',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    status: 'in_progress',
    progressPercent: 45,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002',
  },
};

export const sampleTicketParsedEvent: DomainEvent = {
  type: 'TICKET_PARSED',
  payload: {
    ticketKey: 'OPL-1234',
    summary: 'Add OAuth support',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-003',
  },
};
