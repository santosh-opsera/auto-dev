import type {
  CursorConventionSnapshot,
  CursorConventionValidation,
  CursorImplementationResult,
  CursorResultValidation,
  CursorScopeValidation,
} from '@autodev/shared-types';
import { createSafeRegExp, UnsafeRegExpError } from '../../lib/safeRegExp.js';

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Builds a matcher from the user-configured commit message template.
 * Placeholders like {ticketKey} / {description} become concrete or wildcard segments.
 * Patterns are NEVER hardcoded — always derived from convention settings.
 */
export function commitMessageMatchesFormat(
  commitMessage: string,
  commitMessageFormat: string,
  variables: Record<string, string>,
): boolean {
  let pattern = '';
  let index = 0;
  const source = commitMessageFormat;

  while (index < source.length) {
    if (source[index] === '{') {
      const end = source.indexOf('}', index);
      if (end === -1) {
        pattern += escapeRegExp(source.slice(index));
        break;
      }
      const key = source.slice(index + 1, end);
      const concrete = variables[key];
      // Concrete substitutions are escaped; unknown placeholders become wildcards.
      pattern += concrete !== undefined ? escapeRegExp(concrete) : '.+';
      index = end + 1;
      continue;
    }

    pattern += escapeRegExp(source[index]!);
    index += 1;
  }

  try {
    return createSafeRegExp(`^${pattern}$`).test(commitMessage);
  } catch {
    return false;
  }
}

export function collectTouchedFiles(result: CursorImplementationResult): string[] {
  const paths = new Set<string>();

  for (const change of result.fileChanges) {
    paths.add(change.path);
  }
  for (const path of result.newFiles) {
    paths.add(path);
  }
  for (const path of result.deletedFiles) {
    paths.add(path);
  }

  return [...paths].sort();
}

export function validateResultAgainstChunkScope(
  result: CursorImplementationResult,
  expectedFiles: readonly string[],
): CursorScopeValidation {
  const expected = [...expectedFiles];
  const expectedSet = new Set(expected);
  const touchedFiles = collectTouchedFiles(result);
  const unexpectedFiles = touchedFiles.filter((path) => !expectedSet.has(path));

  return {
    valid: unexpectedFiles.length === 0,
    expectedFiles: expected,
    touchedFiles,
    unexpectedFiles,
  };
}

export function validateConventionCompliance(
  result: CursorImplementationResult,
  conventions: CursorConventionSnapshot,
  variables: Record<string, string>,
): CursorConventionValidation {
  const issues: string[] = [];
  const branchNamingPattern = conventions.branchNamingPattern;
  const commitMessageFormat = conventions.commitMessageFormat;

  let branchValid = true;
  if (result.branchName) {
    try {
      branchValid = createSafeRegExp(branchNamingPattern).test(result.branchName);
    } catch (error) {
      branchValid = false;
      issues.push(
        error instanceof UnsafeRegExpError
          ? error.message
          : 'Configured branchNamingPattern is not a valid regular expression.',
      );
    }
    if (!branchValid && issues.length === 0) {
      issues.push(
        `Branch name "${result.branchName}" does not match configured pattern ${branchNamingPattern}.`,
      );
    }
  } else {
    branchValid = false;
    issues.push('Implementation result is missing branchName for convention validation.');
  }

  let commitValid = true;
  if (result.commitMessage) {
    commitValid = commitMessageMatchesFormat(
      result.commitMessage,
      commitMessageFormat,
      variables,
    );
    if (!commitValid) {
      issues.push(
        `Commit message does not match configured format "${commitMessageFormat}".`,
      );
    }
  } else {
    commitValid = false;
    issues.push('Implementation result is missing commitMessage for convention validation.');
  }

  return {
    valid: branchValid && commitValid,
    branchValid,
    commitValid,
    branchNamingPattern,
    commitMessageFormat,
    issues,
  };
}

export function validateCursorImplementationResult(input: {
  result: CursorImplementationResult;
  expectedFiles: readonly string[];
  conventions: CursorConventionSnapshot;
  ticketKey: string;
}): CursorResultValidation {
  return {
    scope: validateResultAgainstChunkScope(input.result, input.expectedFiles),
    conventions: validateConventionCompliance(input.result, input.conventions, {
      ticketKey: input.ticketKey,
    }),
  };
}
