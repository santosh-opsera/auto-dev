import type { DomainEvent } from '../events.js';

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

export const sampleChunkCreatedEvent: DomainEvent = {
  type: 'CHUNK_CREATED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    prdId: 'prd-003',
    name: 'Data model and shared types',
    order: 0,
    status: 'PENDING',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002a',
  },
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

export const sampleTestingStartedEvent: DomainEvent = {
  type: 'TESTING_STARTED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    maxIterations: 5,
    framework: 'vitest',
    testCount: 3,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002b',
  },
};

export const sampleTestingIterationEvent: DomainEvent = {
  type: 'TESTING_ITERATION',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iteration: 1,
    maxIterations: 5,
    passed: false,
    failedCount: 1,
    identifiedIssues: ['add subtracts operands'],
    fixesApplied: 1,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002c',
  },
};

export const sampleTestingPassedEvent: DomainEvent = {
  type: 'TESTING_PASSED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iterationsUsed: 2,
    coveragePercent: 80.75,
    passedCount: 3,
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002d',
  },
};

export const sampleTestingFailedEvent: DomainEvent = {
  type: 'TESTING_FAILED',
  payload: {
    workflowId: 'workflow-001',
    chunkId: 'chunk-001',
    iterationsUsed: 5,
    maxIterations: 5,
    failedCount: 1,
    rootCauseSummary: 'Max iterations exhausted with failing tests.',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-002e',
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

export const sampleWorkflowTransitionedEvent: DomainEvent = {
  type: 'WORKFLOW_TRANSITIONED',
  payload: {
    workflowId: 'workflow-001',
    previousState: 'CREATED',
    newState: 'TICKET_PARSED',
    trigger: 'ticket.parsed',
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-004',
  },
};

export const sampleWorkflowFailedEvent: DomainEvent = {
  type: 'WORKFLOW_FAILED',
  payload: {
    workflowId: 'workflow-001',
    previousState: 'TESTING',
    error: {
      message: 'Integration test suite failed',
      code: 'TEST_SUITE_FAILED',
      failedFrom: 'TESTING',
    },
  },
  metadata: {
    ...sampleEventMetadata,
    eventId: 'event-005',
  },
};
