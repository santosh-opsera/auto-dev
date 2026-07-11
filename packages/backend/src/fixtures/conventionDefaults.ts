export const defaultConventionTemplates = {
  commitMessageFormat: '{type}({scope}): {description} [{ticketKey}]',
  branchNamingPattern: '^{type}/{ticketKey}-{description}$',
  prTitleTemplate: '[{ticketKey}] {summary}',
  prDescriptionTemplate: '## Summary\n{summary}\n\n## Changes\n{changes}',
  reviewerAssignmentRules: {
    mode: 'manual-list' as const,
    reviewers: ['octocat'],
  },
};

export const conventionTemplateVariables = [
  'ticketKey',
  'type',
  'description',
  'scope',
  'summary',
  'changes',
];
