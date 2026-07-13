import { describe, expect, it } from 'vitest';
import { domainEventSchema, eventTypeSchema } from './events.js';
import {
  sampleChunkCreatedEvent,
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
  sampleDependencyUpdateAvailableEvent,
  samplePrCreatedEvent,
  sampleTestingFailedEvent,
  sampleTestingIterationEvent,
  sampleTestingPassedEvent,
  sampleTestingStartedEvent,
  sampleWorkflowFailedEvent,
  sampleWorkflowTransitionedEvent,
} from './fixtures/events.js';

describe('event schemas', () => {
  it('accepts all required event types', () => {
    expect(eventTypeSchema.options).toEqual([
      'TICKET_PARSED',
      'ANALYSIS_STARTED',
      'ANALYSIS_PROGRESS',
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
      'PR_CREATED',
      'WORKFLOW_TRANSITIONED',
      'WORKFLOW_FAILED',
      'DEPENDENCY_UPDATE_AVAILABLE',
    ]);
  });

  it('validates sample domain events', () => {
    expect(domainEventSchema.safeParse(sampleConventionUpdatedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleChunkCreatedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleChunkProgressEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleTestingStartedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleTestingIterationEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleTestingPassedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleTestingFailedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(samplePrCreatedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleWorkflowTransitionedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleWorkflowFailedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleDependencyUpdateAvailableEvent).success).toBe(true);
  });

  it('rejects events with invalid payloads', () => {
    const result = domainEventSchema.safeParse({
      ...sampleConventionUpdatedEvent,
      payload: { settingsId: '', version: 0 },
    });
    expect(result.success).toBe(false);
  });
});
