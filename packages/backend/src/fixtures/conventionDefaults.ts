export const DEFAULT_PR_DESCRIPTION_TEMPLATE = `## Summary
{summary}

## Changes
{changes}

## Jira Ticket
{jiraTicketUrl}

## Test Results
{testResults}

## Analysis Notes
{analysisNotes}

## Context
{context}`;

export const defaultConventionTemplates = {
  commitMessageFormat: '{ticketKey}: {description}',
  /** Generation template — services must resolve this, never hardcode branch names. */
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: DEFAULT_PR_DESCRIPTION_TEMPLATE,
  reviewerAssignmentRules: {
    mode: 'manual-list' as const,
    reviewers: ['octocat'],
  },
};

export const conventionTemplateVariables = [
  'ticketKey',
  'description',
  'summary',
  'context',
  'changes',
  'type',
  'jiraTicketUrl',
  'testResults',
  'analysisNotes',
];
