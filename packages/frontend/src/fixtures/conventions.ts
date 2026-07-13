import type {
  ConventionDefaultsResponse,
  ConventionHistoryResponse,
  ConventionSettingsInput,
  ConventionSettingsResponse,
} from '@autodev/shared-types';

export const DEFAULT_PR_DESCRIPTION_TEMPLATE = `Context
{context}

Changes in codebase
{changes}

Jira Ticket
https://opsera.atlassian.net/browse/{ticketKey}`;

export const mockConventionInput: ConventionSettingsInput = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: DEFAULT_PR_DESCRIPTION_TEMPLATE,
  reviewerAssignmentRules: {
    mode: 'manual-list',
    reviewers: ['octocat'],
  },
};

export const mockConventionSettings: ConventionSettingsResponse = {
  ...mockConventionInput,
  id: 'settings-001',
  userId: 'user-001',
  version: 1,
  isActive: true,
  createdAt: '2026-07-11T07:00:00.000Z',
  updatedAt: '2026-07-11T07:00:00.000Z',
};

export const mockConventionDefaults: ConventionDefaultsResponse = {
  templates: mockConventionInput,
  availableVariables: ['ticketKey', 'description', 'summary', 'context', 'changes', 'type'],
};

export const mockConventionHistory: ConventionHistoryResponse = {
  versions: [
    {
      ...mockConventionSettings,
      version: 2,
      isActive: true,
      previousVersionId: 'settings-001',
      prTitleTemplate: 'OPL-35139 updated summary',
      id: 'settings-002',
      createdAt: '2026-07-11T08:00:00.000Z',
      updatedAt: '2026-07-11T08:00:00.000Z',
    },
    mockConventionSettings,
  ],
};
