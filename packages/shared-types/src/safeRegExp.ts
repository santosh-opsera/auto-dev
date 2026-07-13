/**
 * Shared RegExp safety checks (ReDoS heuristics).
 * Used by convention validation and backend createSafeRegExp.
 */

export const MAX_REGEXP_PATTERN_LENGTH = 200;

/** Nested quantifiers that commonly enable catastrophic backtracking. */
const NESTED_QUANTIFIER =
  /(\([^()]*[+*][^()]*\)|\([^()]*\{[^}]+\}[^()]*\))[+*{]|(\[[^\]]*[+*][^\]]*\])[+*{]/;

/** Overly broad quantified groups that amplify backtracking. */
const EXPLOSIVE_GROUP = /\((?:[^)\\]*[.\\][^)]*)?[+*]\)[+*{]/;

/** Too many quantified tokens in one pattern (heuristic budget). */
const MAX_QUANTIFIERS = 25;

export type RegExpSafetyIssue =
  | 'empty'
  | 'too_long'
  | 'nested_quantifiers'
  | 'explosive_group'
  | 'excessive_quantifiers'
  | 'invalid_syntax';

export function describeRegExpSafetyIssue(issue: RegExpSafetyIssue): string {
  switch (issue) {
    case 'empty':
      return 'Regular expression pattern must not be empty.';
    case 'too_long':
      return `Regular expression pattern must be ${MAX_REGEXP_PATTERN_LENGTH} characters or fewer.`;
    case 'nested_quantifiers':
      return 'Regular expression pattern rejects nested quantifiers that can cause catastrophic backtracking (ReDoS).';
    case 'explosive_group':
      return 'Regular expression pattern rejects quantified groups that can cause excessive backtracking (ReDoS).';
    case 'excessive_quantifiers':
      return `Regular expression pattern has too many quantifiers (max ${MAX_QUANTIFIERS}).`;
    case 'invalid_syntax':
      return 'Regular expression pattern has invalid syntax.';
  }
}

export function findRegExpSafetyIssue(pattern: string): RegExpSafetyIssue | null {
  if (!pattern) {
    return 'empty';
  }
  if (pattern.length > MAX_REGEXP_PATTERN_LENGTH) {
    return 'too_long';
  }
  if (NESTED_QUANTIFIER.test(pattern) || /(\([^)]*[+*][^)]*\))[+*]/.test(pattern)) {
    return 'nested_quantifiers';
  }
  if (EXPLOSIVE_GROUP.test(pattern)) {
    return 'explosive_group';
  }

  const quantifierCount = (pattern.match(/(?:\*\?|\+\?|\?\?|[*+?]|\{\d+(?:,\d*)?\})/g) ?? [])
    .length;
  if (quantifierCount > MAX_QUANTIFIERS) {
    return 'excessive_quantifiers';
  }

  try {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp
    // Syntax probe only; callers must use createSafeRegExp / isSafeRegExpPattern gates.
    RegExp(pattern);
  } catch {
    return 'invalid_syntax';
  }

  return null;
}

export function isSafeRegExpPattern(pattern: string): boolean {
  return findRegExpSafetyIssue(pattern) === null;
}
