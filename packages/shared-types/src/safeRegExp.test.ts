import { describe, expect, it } from 'vitest';
import {
  branchNamingPatternSchema,
  createSafeRegExp,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
  isValidRegexPattern,
  MAX_REGEXP_PATTERN_LENGTH,
  UnsafeRegExpError,
} from './index.js';

describe('safeRegExp (shared-types)', () => {
  it('accepts normal convention patterns', () => {
    expect(isSafeRegExpPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
    expect(isValidRegexPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
    expect(branchNamingPatternSchema.safeParse('^(feature|bugfix)/OPL-\\d+$').success).toBe(true);
    expect(createSafeRegExp('^(feature|bugfix)/OPL-\\d+$').test('feature/OPL-1')).toBe(true);
  });

  it('rejects ReDoS-prone, invalid, and oversized patterns via schema', () => {
    expect(findRegExpSafetyIssue('(a+)+')).toBe('nested_quantifiers');
    expect(isValidRegexPattern('(a+)+')).toBe(false);
    expect(branchNamingPatternSchema.safeParse('(a+)+').success).toBe(false);
    expect(findRegExpSafetyIssue('[invalid')).toBe('invalid_syntax');
    expect(() => createSafeRegExp('[invalid')).toThrow(UnsafeRegExpError);

    const tooLong = `^${'a'.repeat(MAX_REGEXP_PATTERN_LENGTH)}$`;
    expect(isValidRegexPattern(tooLong)).toBe(false);
    expect(branchNamingPatternSchema.safeParse(tooLong).success).toBe(false);
  });
});
