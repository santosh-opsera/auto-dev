import { describe, expect, it } from 'vitest';
import { domainEventSchema, eventTypeSchema } from './events.js';
import { sampleChunkProgressEvent, sampleConventionUpdatedEvent } from './fixtures/events.js';

describe('event schemas', () => {
  it('accepts all required event types', () => {
    expect(eventTypeSchema.options).toEqual([
      'TICKET_PARSED',
      'ANALYSIS_STARTED',
      'ANALYSIS_COMPLETED',
      'DIVERGENCE_DETECTED',
      'APPROVAL_REQUESTED',
      'APPROVAL_RESOLVED',
      'CONVENTION_UPDATED',
      'CHUNK_PROGRESS',
    ]);
  });

  it('validates sample domain events', () => {
    expect(domainEventSchema.safeParse(sampleConventionUpdatedEvent).success).toBe(true);
    expect(domainEventSchema.safeParse(sampleChunkProgressEvent).success).toBe(true);
  });

  it('rejects events with invalid payloads', () => {
    const result = domainEventSchema.safeParse({
      ...sampleConventionUpdatedEvent,
      payload: { settingsId: '', version: 0 },
    });
    expect(result.success).toBe(false);
  });
});
