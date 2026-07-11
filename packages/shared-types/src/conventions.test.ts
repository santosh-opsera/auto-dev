import { describe, expect, it } from 'vitest';
import {
  branchNamingPatternSchema,
  conventionSettingsInputSchema,
  githubUsernameSchema,
  isValidRegexPattern,
} from './conventions.js';

describe('convention schemas', () => {
  it('accepts valid regex branch naming patterns', () => {
    expect(isValidRegexPattern('^feature/[A-Z]+-\\d+$')).toBe(true);
    expect(branchNamingPatternSchema.safeParse('^feature/[A-Z]+-\\d+$').success).toBe(true);
  });

  it('rejects invalid regex branch naming patterns', () => {
    const result = branchNamingPatternSchema.safeParse('[invalid');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Example:');
    }
  });

  it('validates GitHub usernames in reviewer lists', () => {
    expect(githubUsernameSchema.safeParse('octocat').success).toBe(true);
    expect(githubUsernameSchema.safeParse('not valid!').success).toBe(false);
  });

  it('requires non-empty commit message format with example', () => {
    const result = conventionSettingsInputSchema.safeParse({
      commitMessageFormat: '',
      branchNamingPattern: '^feature/[A-Z]+-\\d+$',
      prTitleTemplate: '[{ticketKey}] {summary}',
      prDescriptionTemplate: '## Summary\n{summary}',
      reviewerAssignmentRules: { mode: 'code-owner-based' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Example:');
    }
  });
});
