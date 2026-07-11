import { describe, expect, it } from 'vitest';
import { sampleNormalizedTicket, sampleTicketIntent } from '@autodev/shared-types';
import { parseTicketIntent } from './ticketParser.js';

describe('parseTicketIntent', () => {
  it('maps normalized tickets into structured ticket intent documents', () => {
    const intent = parseTicketIntent(sampleNormalizedTicket);

    expect(intent.ticketKey).toBe(sampleTicketIntent.ticketKey);
    expect(intent.problemStatement).toBe(sampleTicketIntent.problemStatement);
    expect(intent.proposedApproach).toBe(sampleTicketIntent.proposedApproach);
    expect(intent.acceptanceCriteria).toEqual(sampleTicketIntent.acceptanceCriteria);
    expect(intent.dependencies).toEqual(['OPL-1200']);
    expect(intent.metadata.issueType).toBe('Story');
  });
});
