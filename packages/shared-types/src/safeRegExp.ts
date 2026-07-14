/**
 * Shared RegExp safety checks (ReDoS heuristics) + guarded compile.
 * Used by convention validation and backend createSafeRegExp.
 */

import { RegExpValidator } from '@eslint-community/regexpp';

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

function hasValidRegexSyntax(pattern: string): boolean {
  try {
    new RegExpValidator().validatePattern(pattern);
    return true;
  } catch {
    return false;
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

  if (!hasValidRegexSyntax(pattern)) {
    return 'invalid_syntax';
  }

  return null;
}

export function isSafeRegExpPattern(pattern: string): boolean {
  return findRegExpSafetyIssue(pattern) === null;
}

export class UnsafeRegExpError extends Error {
  readonly issue: RegExpSafetyIssue;

  constructor(issue: RegExpSafetyIssue, pattern: string) {
    super(
      `${describeRegExpSafetyIssue(issue)} Refusing to compile pattern ` +
        `(length ${pattern.length}): ${JSON.stringify(pattern.slice(0, 80))}${
          pattern.length > 80 ? '…' : ''
        }`,
    );
    this.name = 'UnsafeRegExpError';
    this.issue = issue;
  }
}

/**
 * Compile a RegExp only after length and ReDoS heuristic checks.
 * Single intentional non-literal compile site for the monorepo.
 */
export function createSafeRegExp(pattern: string, flags?: string): RegExp {
  const issue = findRegExpSafetyIssue(pattern);
  if (issue) {
    throw new UnsafeRegExpError(issue, pattern);
  }
  try {
    return flags === undefined
      ? new RegExp(pattern) // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
      : new RegExp(pattern, flags); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp
  } catch {
    throw new UnsafeRegExpError('invalid_syntax', pattern);
  }
}

export function assertSafeRegExpPattern(pattern: string): void {
  const issue = findRegExpSafetyIssue(pattern);
  if (issue) {
    throw new UnsafeRegExpError(issue, pattern);
  }
}
