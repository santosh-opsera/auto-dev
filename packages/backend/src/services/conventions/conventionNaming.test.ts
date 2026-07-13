import { describe, expect, it } from 'vitest';
import { sampleBranchCommitConventions } from '@autodev/shared-types';
import {
  applyConventionTemplate,
  generateBranchName,
  generateCommitMessage,
  matchesBranchNamingPattern,
  slugifyDescription,
  validateCommitMessageAgainstFormat,
} from './conventionNaming.js';

describe('conventionNaming', () => {
  it('generates branch names from configured template variables', () => {
    const result = generateBranchName({
      branchNameTemplate: sampleBranchCommitConventions.branchNameTemplate!,
      branchNamingPattern: sampleBranchCommitConventions.branchNamingPattern,
      type: 'feature',
      ticketKey: 'OPL-1234',
      description: 'Add user auth',
    });

    expect(result.valid).toBe(true);
    expect(result.branchName).toBe('feature/OPL-1234-add-user-auth');
    expect(
      matchesBranchNamingPattern(
        result.branchName,
        sampleBranchCommitConventions.branchNamingPattern,
      ),
    ).toBe(true);
  });

  it('falls back to template without description when regex requires it', () => {
    const result = generateBranchName({
      branchNameTemplate: '{type}/{ticketKey}-{description}',
      branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
      type: 'feature',
      ticketKey: 'OPL-1234',
      description: 'Add user auth',
    });

    expect(result.valid).toBe(true);
    expect(result.branchName).toBe('feature/OPL-1234');
  });

  it('rejects branch names that cannot satisfy the configured pattern', () => {
    const result = generateBranchName({
      branchNameTemplate: '{type}/{ticketKey}-{description}',
      branchNamingPattern: '^wo/WO-\\d+-[a-z0-9-]+$',
      type: 'feature',
      ticketKey: 'OPL-1234',
      description: 'Add user auth',
    });

    expect(result.valid).toBe(false);
    expect(result.reason).toContain('does not match configured pattern');
  });

  it('formats commit messages from configured template including ticket key', () => {
    const result = generateCommitMessage({
      commitMessageFormat: sampleBranchCommitConventions.commitMessageFormat,
      ticketKey: 'OPL-1234',
      description: 'Add user auth',
    });

    expect(result.valid).toBe(true);
    expect(result.commitMessage).toBe('OPL-1234: Add user auth');
    expect(
      validateCommitMessageAgainstFormat(
        result.commitMessage,
        sampleBranchCommitConventions.commitMessageFormat,
        { ticketKey: 'OPL-1234', description: 'Add user auth' },
      ),
    ).toBe(true);
  });

  it('slugifies descriptions and applies templates', () => {
    expect(slugifyDescription('Add User Auth!!!')).toBe('add-user-auth');
    expect(
      applyConventionTemplate('{type}/{ticketKey}-{description}', {
        type: 'bugfix',
        ticketKey: 'OPL-9',
        description: 'fix-login',
      }),
    ).toBe('bugfix/OPL-9-fix-login');
  });
});
