export {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleEventMetadata,
  sampleTicketParsedEvent,
} from '@autodev/shared-types';

import type { DomainEvent, EventType } from '@autodev/shared-types';
import {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleTicketParsedEvent,
} from '@autodev/shared-types';

export const sampleDomainEvents: DomainEvent[] = [
  sampleConventionUpdatedEvent,
  sampleChunkProgressEvent,
  sampleTicketParsedEvent,
];

export const sampleEventTypes: EventType[] = [
  'TICKET_PARSED',
  'ANALYSIS_STARTED',
  'ANALYSIS_COMPLETED',
  'DIVERGENCE_DETECTED',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'CONVENTION_UPDATED',
  'CHUNK_PROGRESS',
];
