import { describe, expect, it } from 'vitest';
import { sampleJiraIssueResponse, sampleNormalizedTicket } from '@autodev/shared-types';
import { normalizeJiraIssue } from './ticketNormalizer.js';

describe('normalizeJiraIssue', () => {
  it('maps Jira REST payloads into normalized ticket JSON', () => {
    expect(normalizeJiraIssue(sampleJiraIssueResponse)).toEqual(sampleNormalizedTicket);
  });

  it('handles partial issue payloads gracefully', () => {
    const normalized = normalizeJiraIssue({
      key: 'OPL-9999',
      fields: {
        summary: 'Partial ticket',
      },
    });

    expect(normalized.ticketKey).toBe('OPL-9999');
    expect(normalized.summary).toBe('Partial ticket');
    expect(normalized.acceptanceCriteria).toEqual([]);
    expect(normalized.linkedIssues).toEqual([]);
  });
});
