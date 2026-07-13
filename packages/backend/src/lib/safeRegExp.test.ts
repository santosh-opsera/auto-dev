import { describe, expect, it } from 'vitest';
import {
  createSafeRegExp,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
  MAX_REGEXP_PATTERN_LENGTH,
  UnsafeRegExpError,
} from './safeRegExp.js';

describe('safeRegExp', () => {
  it('compiles safe branch naming patterns', () => {
    const re = createSafeRegExp('^(feature|bugfix)/OPL-\\d+$');
    expect(re.test('feature/OPL-123')).toBe(true);
    expect(isSafeRegExpPattern('^(feature|bugfix)/OPL-\\d+$')).toBe(true);
  });

  it('rejects patterns longer than the max length', () => {
    const pattern = 'a'.repeat(MAX_REGEXP_PATTERN_LENGTH + 1);
    expect(findRegExpSafetyIssue(pattern)).toBe('too_long');
    expect(() => createSafeRegExp(pattern)).toThrow(UnsafeRegExpError);
    expect(() => createSafeRegExp(pattern)).toThrow(/200 characters or fewer/);
  });

  it('rejects nested quantifiers that enable ReDoS', () => {
    expect(findRegExpSafetyIssue('(a+)+')).toBe('nested_quantifiers');
    expect(findRegExpSafetyIssue('(a*)*')).toBe('nested_quantifiers');
    expect(() => createSafeRegExp('(a+)+b')).toThrow(/nested quantifiers/);
  });

  it('rejects invalid syntax with a clear error', () => {
    expect(findRegExpSafetyIssue('[invalid')).toBe('invalid_syntax');
    expect(() => createSafeRegExp('[invalid')).toThrow(UnsafeRegExpError);
  });
});
