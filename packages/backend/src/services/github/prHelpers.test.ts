import { describe, expect, it } from 'vitest';
import {
  buildJiraTicketUrl,
  inferChangeTypeFromBranch,
  labelForPrChangeType,
  parseCodeOwners,
  resolvePrDescription,
  resolvePrTitle,
  selectReviewersFromRules,
} from './prHelpers.js';
import { mockGitHubCodeOwnersFile } from '@autodev/shared-types';

describe('prHelpers', () => {
  it('resolves PR title and description from configured templates', () => {
    expect(
      resolvePrTitle('{ticketKey} {summary}', {
        ticketKey: 'OPL-1234',
        summary: 'Add user auth',
      }),
    ).toBe('OPL-1234 Add user auth');

    const body = resolvePrDescription(
      '## Summary\n{summary}\n\n## Jira\n{jiraTicketUrl}\n\n## Tests\n{testResults}\n\n## Notes\n{analysisNotes}',
      {
        summary: 'Add user auth',
        jiraTicketUrl: 'https://opsera.atlassian.net/browse/OPL-1234',
        testResults: '3 passed',
        analysisNotes: 'service-layer',
      },
    );

    expect(body).toContain('Add user auth');
    expect(body).toContain('https://opsera.atlassian.net/browse/OPL-1234');
    expect(body).toContain('3 passed');
    expect(body).toContain('service-layer');
  });

  it('assigns reviewers for round-robin, manual-list, and code-owner modes', () => {
    const round1 = selectReviewersFromRules(
      { mode: 'round-robin', reviewers: ['alice', 'bob', 'carol'] },
      0,
    );
    expect(round1.reviewers).toEqual(['alice']);
    expect(round1.nextCursor).toBe(1);

    const round2 = selectReviewersFromRules(
      { mode: 'round-robin', reviewers: ['alice', 'bob', 'carol'] },
      round1.nextCursor!,
    );
    expect(round2.reviewers).toEqual(['bob']);

    expect(
      selectReviewersFromRules({ mode: 'manual-list', reviewers: ['octocat', 'hubot'] }).reviewers,
    ).toEqual(['octocat', 'hubot']);

    expect(selectReviewersFromRules({ mode: 'code-owner-based' }).reviewers).toEqual([]);
  });

  it('parses CODEOWNERS for matching paths', () => {
    const owners = parseCodeOwners(mockGitHubCodeOwnersFile, [
      'packages/backend/src/services/github/prCreationService.ts',
    ]);
    expect(owners).toEqual(expect.arrayContaining(['octocat', 'hubot']));
  });

  it('maps change types to labels and infers from branch names', () => {
    expect(labelForPrChangeType('feature')).toBe('feature');
    expect(labelForPrChangeType('bugfix')).toBe('bugfix');
    expect(inferChangeTypeFromBranch('bugfix/OPL-1-fix')).toBe('bugfix');
    expect(inferChangeTypeFromBranch('refactor/OPL-1-cleanup')).toBe('refactor');
    expect(inferChangeTypeFromBranch('docs/OPL-1-readme')).toBe('documentation');
    expect(inferChangeTypeFromBranch('feature/OPL-1-auth')).toBe('feature');
  });

  it('builds Jira ticket URLs from site configuration', () => {
    expect(buildJiraTicketUrl('OPL-1234', 'https://opsera.atlassian.net')).toBe(
      'https://opsera.atlassian.net/browse/OPL-1234',
    );
  });
});
