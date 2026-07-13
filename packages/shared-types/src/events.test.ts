import { describe, expect, it } from 'vitest';
import { domainEventSchema, eventTypeSchema } from './events.js';
import {
  sampleChunkProgressEvent,
  sampleConventionUpdatedEvent,
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
      'CHUNK_PROGRESS',
      'WORKFLOW_TRANSITIONED',
      'WORKFLOW_FAILED',
    ]);
  });

  it('validates sample domain events', () => {
    expect(domainEventSchema.safeParse(sampleConventionUpdatedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleChunkProgressEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleWorkflowTransitionedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleWorkflowFailedEvent).success).toBe(true);
  });

  it('rejects events with invalid payloads', () => {
    const result = domainEventSchema.safeParse({
      ...sampleConventionUpdatedEvent,
      payload: { settingsId: '', version: 0 },
    });
    expect(result.success).toBe(false);
  });
});
