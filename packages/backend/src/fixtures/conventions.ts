import type { ConventionSettingsInput } from '@autodev/shared-types';
import { DEFAULT_PR_DESCRIPTION_TEMPLATE } from './conventionDefaults.js';

export const validConventionSettingsInput: ConventionSettingsInput = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: DEFAULT_PR_DESCRIPTION_TEMPLATE,
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
