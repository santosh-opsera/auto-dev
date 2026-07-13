export {
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleEventMetadata,
  sampleTestingFailedEvent,
  sampleTestingIterationEvent,
  sampleTestingPassedEvent,
  sampleTestingStartedEvent,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from '@autodev/shared-types';

import type { DomainEvent, EventType } from '@autodev/shared-types';
import {
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleTestingFailedEvent,
  sampleTestingIterationEvent,
  sampleTestingPassedEvent,
  sampleTestingStartedEvent,
  sampleTicketParsedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from '@autodev/shared-types';

export const sampleDomainEvents: DomainEvent[] = [
  sampleConventionUpdatedEvent,
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleTestingStartedEvent,
  sampleTestingIterationEvent,
  sampleTestingPassedEvent,
  sampleTestingFailedEvent,
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
  'TESTING_STARTED',
  'TESTING_ITERATION',
  'TESTING_PASSED',
  'TESTING_FAILED',
  'WORKFLOW_TRANSITIONED',
  'WORKFLOW_FAILED',
];
