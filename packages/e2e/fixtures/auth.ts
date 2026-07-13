import type { ConventionSettingsInput } from '@autodev/shared-types';

export const e2eConventionSettings: ConventionSettingsInput = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/OPL-\\d+',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate:
    '## Summary\n{summary}\n\n## Ticket\n{ticketKey}\n\n## Test plan\n- [ ] Verified locally\n',
  reviewerAssignmentRules: {
    mode: 'manual-list',
    reviewers: ['octocat', 'hubot'],
  },
};

export const seededSessionUser = {
  email: 'e2e.alex@example.com',
  displayName: 'E2E Alex',
  connectedProviders: ['github', 'atlassian'] as const,
  integrations: {
    jira: true,
    githubRepos: true,
  },
};

export const seededSessionMetadata = {
  remainingMs: 23 * 60 * 60 * 1000,
  warning: false,
  expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
};

export const warningSessionMetadata = {
  remainingMs: 3 * 60 * 1000,
  warning: true,
  expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
};
