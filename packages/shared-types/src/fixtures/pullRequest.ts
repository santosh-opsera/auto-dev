import type { ConventionSettingsInput } from '../conventions.js';
import type {
  CreatePullRequestRequest,
  PullRequestResponse,
} from '../pullRequest.js';

/**
 * Sample conventions with PR templates — services must resolve these, never hardcode titles/bodies.
 */
export const samplePrCreationConventions: ConventionSettingsInput = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/[A-Z]+-\\d+-[a-z0-9-]+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: [
    '## Summary',
    '{summary}',
    '',
    '## Changes',
    '{changes}',
    '',
    '## Jira Ticket',
    '{jiraTicketUrl}',
    '',
    '## Test Results',
    '{testResults}',
    '',
    '## Analysis Notes',
    '{analysisNotes}',
  ].join('\n'),
  reviewerAssignmentRules: {
    mode: 'manual-list',
    reviewers: ['octocat', 'hubot'],
  },
};

export const sampleCreatePullRequestRequest: CreatePullRequestRequest = {
  changeType: 'feature',
  headBranch: 'feature/OPL-1234-add-user-auth',
  baseBranch: 'main',
};

export const samplePullRequestResponse: PullRequestResponse = {
  workflowDocumentId: 'wf-doc-001',
  workflowId: 'workflow-001',
  ticketKey: 'OPL-1234',
  prNumber: 42,
  prUrl: 'https://github.com/santosh-opsera/auto-dev/pull/42',
  title: 'OPL-1234 Add user auth',
  body: [
    '## Summary',
    'Add user auth',
    '',
    '## Changes',
    '- packages/backend/src/services/git/branchCommitService.ts',
    '',
    '## Jira Ticket',
    'https://opsera.atlassian.net/browse/OPL-1234',
    '',
    '## Test Results',
    '3 passed, 0 failed (vitest)',
    '',
    '## Analysis Notes',
    'service-layer pattern; naming confidence high',
  ].join('\n'),
  labels: ['feature'],
  reviewers: ['octocat', 'hubot'],
  changeType: 'feature',
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  headBranch: 'feature/OPL-1234-add-user-auth',
  baseBranch: 'main',
  created: true,
};

/** Expected GitHub API payloads for mocked integration tests. */
export const sampleExpectedGitHubCreatePullRequestPayload = {
  title: 'OPL-1234 Add user auth',
  head: 'feature/OPL-1234-add-user-auth',
  base: 'main',
  body: samplePullRequestResponse.body,
};

export const mockGitHubPullRequestResponse = {
  id: 1,
  number: 42,
  html_url: 'https://github.com/santosh-opsera/auto-dev/pull/42',
  title: 'OPL-1234 Add user auth',
  body: samplePullRequestResponse.body,
  head: { ref: 'feature/OPL-1234-add-user-auth' },
  base: { ref: 'main' },
  state: 'open',
};

export const mockGitHubCodeOwnersFile = `# CODEOWNERS
* @octocat
packages/backend/ @hubot
`;

export const sampleRoundRobinReviewers = ['alice', 'bob', 'carol'] as const;
export const sampleManualListReviewers = ['octocat', 'hubot'] as const;
