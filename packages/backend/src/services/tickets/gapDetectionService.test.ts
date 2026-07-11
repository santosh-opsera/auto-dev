import { describe, expect, it } from 'vitest';
import {
  sampleNormalizedTicket,
  sampleStoryWithoutLinks,
  sampleTicketWithMissingAc,
  sampleVagueTicket,
} from '@autodev/shared-types';
import { canProceedToAnalysis, detectTicketGaps, hasCriticalGaps } from './gapDetectionService.js';
import { parseTicketIntent } from './ticketParser.js';

describe('gapDetectionService', () => {
  it('flags missing acceptance criteria as critical', () => {
    const intent = parseTicketIntent(sampleTicketWithMissingAc);
    const gaps = detectTicketGaps(sampleTicketWithMissingAc, intent);

    expect(hasCriticalGaps(gaps)).toBe(true);
    expect(canProceedToAnalysis(gaps)).toBe(false);
    expect(gaps[0]?.field).toBe('acceptanceCriteria');
  });

  it('flags vague descriptions as warnings', () => {
    const intent = parseTicketIntent(sampleVagueTicket);
    const gaps = detectTicketGaps(sampleVagueTicket, intent);

    expect(hasCriticalGaps(gaps)).toBe(false);
    expect(gaps.some((gap) => gap.field === 'description')).toBe(true);
  });

  it('flags story tickets without linked issues as warnings', () => {
    const intent = parseTicketIntent(sampleStoryWithoutLinks);
    const gaps = detectTicketGaps(sampleStoryWithoutLinks, intent);

    expect(gaps.some((gap) => gap.field === 'linkedIssues')).toBe(true);
    expect(canProceedToAnalysis(gaps)).toBe(true);
  });

  it('allows complete tickets to proceed', () => {
    const intent = parseTicketIntent(sampleNormalizedTicket);
    const gaps = detectTicketGaps(sampleNormalizedTicket, intent);

    expect(gaps).toEqual([]);
    expect(canProceedToAnalysis(gaps)).toBe(true);
  });
});
