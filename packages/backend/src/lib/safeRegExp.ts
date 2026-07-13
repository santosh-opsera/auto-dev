import {
  MAX_REGEXP_PATTERN_LENGTH,
  describeRegExpSafetyIssue,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
  type RegExpSafetyIssue,
} from '@autodev/shared-types';

export {
  MAX_REGEXP_PATTERN_LENGTH,
  describeRegExpSafetyIssue,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
};
export type { RegExpSafetyIssue };

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
 * Throws UnsafeRegExpError with a clear remediation message.
 */
export function createSafeRegExp(pattern: string, flags?: string): RegExp {
  const issue = findRegExpSafetyIssue(pattern);
  if (issue) {
    throw new UnsafeRegExpError(issue, pattern);
  }
  try {
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp
    // Pattern is length-capped and ReDoS-heuristically validated above.
    return flags === undefined ? new RegExp(pattern) : new RegExp(pattern, flags);
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
