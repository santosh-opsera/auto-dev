import {
  sampleApprovalRequestPending,
  sampleNormalizedTicket,
  sampleTicketWithMissingAc,
  sampleCriticalGaps,
  sampleExpectedNamingDivergence,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { e2eConventionSettings, seededSessionMetadata, seededSessionUser } from './auth.js';

export const uiMeResponse = {
  user: seededSessionUser,
  session: seededSessionMetadata,
};

export const uiWarningMeResponse = {
  user: seededSessionUser,
  session: {
    remainingMs: 3 * 60 * 1000,
    warning: true,
    expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
  },
};

export const uiConventionDefaults = {
  templates: e2eConventionSettings,
  availableVariables: ['ticketKey', 'summary', 'description', 'type'],
};

export const uiActiveConventions = {
  settings: null,
};

export const uiTicketResponse = {
  ticket: sampleNormalizedTicket,
  source: 'jira-rest',
};

export const uiParseComplete = {
  intent: {
    ...sampleTicketIntent,
    ticketKey: 'OPL-1234',
    gaps: [],
    canProceedToAnalysis: true,
  },
  gaps: [],
  canProceedToAnalysis: true,
  persistedId: 'intent-e2e-001',
};

export const uiParseWithGaps = {
  intent: {
    ...sampleTicketIntent,
    ticketKey: 'OPL-2001',
    problemStatement: sampleTicketWithMissingAc.summary,
    gaps: sampleCriticalGaps,
    canProceedToAnalysis: false,
  },
  gaps: sampleCriticalGaps,
  canProceedToAnalysis: false,
  persistedId: 'intent-e2e-002',
};

export const uiApprovalRequest = {
  ...sampleApprovalRequestPending,
  id: 'approval-e2e-001',
  ticketKey: 'OPL-6001',
  items: sampleApprovalRequestPending.items.map((item) => ({
    ...item,
    divergence:
      item.type === 'divergence'
        ? sampleExpectedNamingDivergence
        : item.divergence,
  })),
};

export const uiApprovalStatusPending = {
  canProceed: false,
  pendingCount: uiApprovalRequest.items.filter((item) => item.status === 'pending').length,
  status: 'open',
};

export const uiApprovalStatusCleared = {
  canProceed: true,
  pendingCount: 0,
  status: 'cleared',
};
