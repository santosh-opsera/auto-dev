import { describe, expect, it } from 'vitest';
import { sampleNormalizedTicket } from './fixtures/tickets.js';
import {
  normalizedTicketSchema,
  ticketKeySchema,
  ticketResponseSchema,
} from './tickets.js';

describe('ticket schemas', () => {
  it('accepts valid ticket keys', () => {
    expect(ticketKeySchema.parse('OPL-1234')).toBe('OPL-1234');
    expect(ticketKeySchema.parse('proj-1')).toBe('proj-1');
  });

  it('rejects invalid ticket keys', () => {
    expect(() => ticketKeySchema.parse('OPL 1234')).toThrow();
    expect(() => ticketKeySchema.parse('../etc/passwd')).toThrow();
  });

  it('validates normalized ticket responses', () => {
    const payload = {
      ticket: sampleNormalizedTicket,
      source: 'jira-rest' as const,
      fallbackUsed: true,
    };

    expect(ticketResponseSchema.parse(payload)).toEqual(payload);
    expect(normalizedTicketSchema.parse(sampleNormalizedTicket)).toEqual(sampleNormalizedTicket);
  });
});
