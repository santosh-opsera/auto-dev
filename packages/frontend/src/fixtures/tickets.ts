import {
  sampleCriticalGaps,
  sampleNormalizedTicket,
  sampleTicketIntent,
  sampleWarningGaps,
} from '@autodev/shared-types';
import type { TicketParseResponse, TicketResponse } from '@autodev/shared-types';

export const mockTicketResponse: TicketResponse = {
  ticket: sampleNormalizedTicket,
  source: 'jira-rest',
  fallbackUsed: false,
};

export const mockTicketParseSuccess: TicketParseResponse = {
  intent: sampleTicketIntent,
  gaps: [],
  canProceedToAnalysis: true,
  persistedId: 'intent-001',
};

export const mockTicketParseWithCriticalGaps: TicketParseResponse = {
  intent: {
    ...sampleTicketIntent,
    ticketKey: 'OPL-2001',
    acceptanceCriteria: [],
  },
  gaps: sampleCriticalGaps,
  canProceedToAnalysis: false,
  persistedId: 'intent-002',
};

export const mockTicketParseWithWarnings: TicketParseResponse = {
  intent: sampleTicketIntent,
  gaps: sampleWarningGaps,
  canProceedToAnalysis: true,
  persistedId: 'intent-003',
};
