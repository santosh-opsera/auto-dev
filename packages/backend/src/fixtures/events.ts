export {
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleEventMetadata,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from '@autodev/shared-types';

import type { DomainEvent, EventType } from '@autodev/shared-types';
import {
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from '@autodev/shared-types';

export const sampleDomainEvents: DomainEvent[] = [
  sampleConventionUpdatedEvent,
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleTicketParsedEvent,
  sampleWorkflowTransitionedEvent,
  sampleWorkflowFailedEvent,
];

export const sampleEventTypes: EventType[] = [
  'TICKET_PARSED',
  'ANALYSIS_STARTED',
  'ANALYSIS_COMPLETED',
  'DIVERGENCE_DETECTED',
  'DIVERGENCE_NONE',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'APPROVAL_EXPIRED',
  'APPROVAL_REMINDER',
  'CONVENTION_UPDATED',
  'CHUNK_CREATED',
  'CHUNK_PROGRESS',
  'WORKFLOW_TRANSITIONED',
  'WORKFLOW_FAILED',
];
