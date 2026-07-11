import type { ConventionSettingsInput } from '@autodev/shared-types';

export const validConventionSettingsInput: ConventionSettingsInput = {
  commitMessageFormat: '{type}({scope}): {description} [{ticketKey}]',
  branchNamingPattern: '^feature/[A-Z]+-\\d+$',
  prTitleTemplate: '[{ticketKey}] {summary}',
  prDescriptionTemplate: '## Summary\n{summary}',
  reviewerAssignmentRules: {
    mode: 'manual-list',
    reviewers: ['octocat', 'hubot'],
  },
};

export const invalidConventionSettingsCases = {
  emptyCommitFormat: {
    ...validConventionSettingsInput,
    commitMessageFormat: '',
  },
  invalidRegex: {
    ...validConventionSettingsInput,
    branchNamingPattern: '[invalid',
  },
  invalidReviewer: {
    ...validConventionSettingsInput,
    reviewerAssignmentRules: {
      mode: 'manual-list' as const,
      reviewers: ['not a valid username!'],
    },
  },
};
