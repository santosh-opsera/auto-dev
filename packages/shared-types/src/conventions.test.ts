import { describe, expect, it } from 'vitest';
import {
  branchNamingPatternSchema,
  conventionSettingsInputSchema,
  githubUsernameSchema,
  isValidRegexPattern,
} from './conventions.js';

describe('convention schemas', () => {
  it('accepts valid regex branch naming patterns', () => {
    expect(isValidRegexPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
    expect(branchNamingPatternSchema.safeParse('^(feature|bugfix)/OPL-\\d+$').success).toBe(true);
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
      branchNamingPattern: '^(feature|bugfix)/OPL-\\d+$',
      prTitleTemplate: 'OPL-1234 summary of pr',
      prDescriptionTemplate: 'Context\n{context}',
      reviewerAssignmentRules: { mode: 'code-owner-based' },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain('Example:');
    }
  });
});
