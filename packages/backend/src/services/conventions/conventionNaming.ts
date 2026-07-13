/**
 * Convention naming helpers.
 * Branch names and commit messages are ALWAYS derived from user-configured templates.
 * Never hardcode naming formats in callers.
 */

import { createSafeRegExp, UnsafeRegExpError } from '../../lib/safeRegExp.js';

export type ConventionTemplateVariables = Record<string, string>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function slugifyDescription(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function applyConventionTemplate(
  template: string,
  variables: ConventionTemplateVariables,
): string {
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    const value = variables[key];
    return value !== undefined ? value : `{${key}}`;
  });
}

export function matchesBranchNamingPattern(branchName: string, pattern: string): boolean {
  try {
    return createSafeRegExp(pattern).test(branchName);
  } catch (error) {
    if (error instanceof UnsafeRegExpError) {
      return false;
    }
    return false;
  }
}

/**
 * Generates a branch name from the configured template, then validates against the regex.
 * If the full template fails validation and the template ends with `-{description}`,
 * retries without the description segment (still driven by the configured template).
 */
export function generateBranchName(input: {
  branchNameTemplate: string;
  branchNamingPattern: string;
  type: string;
  ticketKey: string;
  description: string;
}): { branchName: string; valid: boolean; reason?: string } {
  const description = slugifyDescription(input.description);
  const variables: ConventionTemplateVariables = {
    type: input.type,
    ticketKey: input.ticketKey,
    description,
  };

  const candidates: string[] = [];
  const primary = applyConventionTemplate(input.branchNameTemplate, variables);
  candidates.push(primary);

  if (input.branchNameTemplate.includes('-{description}')) {
    const withoutDescription = applyConventionTemplate(
      input.branchNameTemplate.replace('-{description}', ''),
      variables,
    );
    if (withoutDescription !== primary) {
      candidates.push(withoutDescription);
    }
  }

  for (const candidate of candidates) {
    if (matchesBranchNamingPattern(candidate, input.branchNamingPattern)) {
      return { branchName: candidate, valid: true };
    }
  }

  return {
    branchName: primary,
    valid: false,
    reason: `Generated branch name "${primary}" does not match configured pattern ${input.branchNamingPattern}.`,
  };
}

export function generateCommitMessage(input: {
  commitMessageFormat: string;
  ticketKey: string;
  description: string;
}): { commitMessage: string; valid: boolean; reason?: string } {
  const commitMessage = applyConventionTemplate(input.commitMessageFormat, {
    ticketKey: input.ticketKey,
    description: input.description.trim(),
  });

  if (!commitMessage.includes(input.ticketKey)) {
    return {
      commitMessage,
      valid: false,
      reason: `Commit message must include Jira ticket key "${input.ticketKey}".`,
    };
  }

  if (!commitMessage.trim()) {
    return {
      commitMessage,
      valid: false,
      reason: 'Commit message resolved to an empty string from the configured template.',
    };
  }

  return { commitMessage, valid: true };
}

export function validateCommitMessageAgainstFormat(
  commitMessage: string,
  commitMessageFormat: string,
  variables: ConventionTemplateVariables,
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
