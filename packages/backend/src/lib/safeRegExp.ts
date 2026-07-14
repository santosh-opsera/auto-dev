/**
 * Backend re-export of shared SafeRegExp helpers.
 * All guarded compilation lives in @autodev/shared-types.
 */

export {
  MAX_REGEXP_PATTERN_LENGTH,
  UnsafeRegExpError,
  assertSafeRegExpPattern,
  createSafeRegExp,
  describeRegExpSafetyIssue,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
  type RegExpSafetyIssue,
} from '@autodev/shared-types';
