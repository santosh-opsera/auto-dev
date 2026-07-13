import { describe, expect, it } from 'vitest';
import {
  branchNamingPatternSchema,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
  isValidRegexPattern,
  MAX_REGEXP_PATTERN_LENGTH,
} from './index.js';

describe('safeRegExp (shared-types)', () => {
  it('accepts normal convention patterns', () => {
    expect(isSafeRegExpPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
    expect(isValidRegexPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
    expect(branchNamingPatternSchema.safeParse('^(feature|bugfix)/OPL-\\d+$').success).toBe(true);
  });

  it('rejects ReDoS-prone and oversized patterns via schema', () => {
    expect(findRegExpSafetyIssue('(a+)+')).toBe('nested_quantifiers');
    expect(isValidRegexPattern('(a+)+')).toBe(false);
    expect(branchNamingPatternSchema.safeParse('(a+)+').success).toBe(false);

    const tooLong = `^${'a'.repeat(MAX_REGEXP_PATTERN_LENGTH)}$`;
    expect(isValidRegexPattern(tooLong)).toBe(false);
    expect(branchNamingPatternSchema.safeParse(tooLong).success).toBe(false);
  });
});
