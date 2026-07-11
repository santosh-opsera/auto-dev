import type { GapItem, TicketIntent } from '../ticketIntent.js';
import type { NormalizedTicket } from '../tickets.js';
import { sampleNormalizedTicket } from './tickets.js';

export const sampleTicketIntent: TicketIntent = {
  ticketKey: 'OPL-1234',
  problemStatement: 'Add OAuth support',
  proposedApproach: 'Implement PKCE flow for secure auth with refresh token rotation and session expiry handling.',
  acceptanceCriteria: [
    'User can sign in with GitHub OAuth',
    'Session persists for 8 hours',
  ],
  affectedComponents: ['backend', 'auth'],
  dependencies: ['OPL-1200'],
  constraints: [],
  metadata: {
    sourceSummary: 'Add OAuth support',
    labels: ['backend', 'auth'],
    issueType: 'Story',
    sprintContext: sampleNormalizedTicket.sprintContext,
    parsedAt: '2026-07-11T08:00:00.000Z',
  },
};

export const sampleTicketWithMissingAc: NormalizedTicket = {
  ticketKey: 'OPL-2001',
  summary: 'Fix login bug',
  description: 'Users cannot login.',
  acceptanceCriteria: [],
  linkedIssues: [],
  attachments: [],
  labels: [],
  issueType: 'Bug',
};

export const sampleVagueTicket: NormalizedTicket = {
  ticketKey: 'OPL-2002',
  summary: 'Improve UI',
  description: 'Make it better',
  acceptanceCriteria: ['UI looks good'],
  linkedIssues: [],
  attachments: [],
  labels: [],
  issueType: 'Story',
};

export const sampleStoryWithoutLinks: NormalizedTicket = {
  ticketKey: 'OPL-2003',
  summary: 'Add dashboard widget',
  description: 'Add a widget that shows active workflows for the signed-in user on the dashboard page.',
  acceptanceCriteria: ['Widget renders active workflow count'],
  linkedIssues: [],
  attachments: [],
  labels: ['frontend'],
  issueType: 'Story',
};

export const sampleCriticalGaps: GapItem[] = [
  {
    field: 'acceptanceCriteria',
    severity: 'critical',
    description: 'No acceptance criteria were found in the ticket.',
    suggestedAction: 'Add explicit acceptance criteria before proceeding to codebase analysis.',
  },
];

export const sampleWarningGaps: GapItem[] = [
  {
    field: 'description',
    severity: 'warning',
    description: 'Description is shorter than 50 characters and may be too vague.',
    suggestedAction: 'Expand the description with implementation context and edge cases.',
  },
  {
    field: 'linkedIssues',
    severity: 'warning',
    description: 'Story ticket has no linked issues for dependency context.',
    suggestedAction: 'Link related epics, tasks, or blocking issues in Jira.',
  },
];
