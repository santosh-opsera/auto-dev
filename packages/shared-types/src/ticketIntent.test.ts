import { describe, expect, it } from 'vitest';
import { sampleCriticalGaps, sampleTicketIntent } from './fixtures/ticketIntent.js';
import { gapItemSchema, ticketIntentSchema, ticketParseResponseSchema } from './ticketIntent.js';

describe('ticketIntent schemas', () => {
  it('validates ticket intent documents', () => {
    expect(ticketIntentSchema.parse(sampleTicketIntent)).toEqual(sampleTicketIntent);
  });

  it('validates parse responses with gap analysis', () => {
    const payload = {
      intent: sampleTicketIntent,
      gaps: sampleCriticalGaps,
      canProceedToAnalysis: false,
      persistedId: 'intent-001',
    };

    expect(ticketParseResponseSchema.parse(payload)).toEqual(payload);
    expect(gapItemSchema.parse(sampleCriticalGaps[0]).severity).toBe('critical');
  });
});
