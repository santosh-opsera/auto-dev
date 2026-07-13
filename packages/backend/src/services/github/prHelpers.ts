import type { ReviewerAssignmentRules } from '@autodev/shared-types';
import { createSafeRegExp } from '../../lib/safeRegExp.js';
import { applyConventionTemplate } from '../conventions/conventionNaming.js';

export type ReviewerAssignmentMode = ReviewerAssignmentRules['mode'];

/**
 * Round-robin: pick one reviewer starting at cursor, then advance.
 * Manual-list: assign the full configured list.
 * Code-owner: resolved separately from CODEOWNERS content.
 */
export function selectReviewersFromRules(
  rules: ReviewerAssignmentRules,
  roundRobinCursor = 0,
): { reviewers: string[]; nextCursor?: number } {
  if (rules.mode === 'code-owner-based') {
    return { reviewers: [] };
  }

  const list = rules.reviewers ?? [];
  if (list.length === 0) {
    return { reviewers: [] };
  }

  if (rules.mode === 'manual-list') {
    return { reviewers: [...list] };
  }

  const index = ((roundRobinCursor % list.length) + list.length) % list.length;
  const selected = list[index]!;
  return {
    reviewers: [selected],
    nextCursor: index + 1,
  };
}

export function labelForPrChangeType(
  changeType: 'feature' | 'bugfix' | 'refactor' | 'documentation',
): string {
  return changeType;
}

export function inferChangeTypeFromBranch(
  branchName: string,
): 'feature' | 'bugfix' | 'refactor' | 'documentation' {
  const lower = branchName.toLowerCase();
  if (lower.startsWith('bugfix/') || lower.includes('/bugfix/') || lower.startsWith('fix/')) {
    return 'bugfix';
  }
  if (lower.startsWith('refactor/') || lower.includes('/refactor/')) {
    return 'refactor';
  }
  if (
    lower.startsWith('docs/') ||
    lower.startsWith('documentation/') ||
    lower.includes('/docs/')
  ) {
    return 'documentation';
  }
  return 'feature';
}

/** Parse CODEOWNERS content and return GitHub usernames (without @) matching changed paths. */
export function parseCodeOwners(content: string, changedPaths: string[]): string[] {
  const owners = new Set<string>();
  const lines = content.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const parts = line.split(/\s+/).filter(Boolean);
    if (parts.length < 2) {
      continue;
    }

    const pattern = parts[0]!;
    const patternOwners = parts
      .slice(1)
      .filter((token) => token.startsWith('@') && !token.includes('/'))
      .map((token) => token.slice(1));

    if (patternOwners.length === 0) {
      continue;
    }

    const matches =
      pattern === '*' ||
      changedPaths.some((path) => pathMatchesCodeOwnerPattern(path, pattern));

    if (matches) {
      for (const owner of patternOwners) {
        owners.add(owner);
      }
    }
  }

  return [...owners];
}

function pathMatchesCodeOwnerPattern(path: string, pattern: string): boolean {
  const normalizedPattern = pattern.replace(/^\//, '');
  if (normalizedPattern.endsWith('/')) {
    return path.startsWith(normalizedPattern) || path.startsWith(normalizedPattern.slice(0, -1));
  }
  if (normalizedPattern.includes('*')) {
    const escaped = normalizedPattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*');
    try {
      return createSafeRegExp(`^${escaped}$`).test(path);
    } catch {
      return false;
    }
  }
  return path === normalizedPattern || path.startsWith(`${normalizedPattern}/`);
}

export function resolvePrTitle(template: string, variables: Record<string, string>): string {
  return applyConventionTemplate(template, variables).trim();
}

export function resolvePrDescription(template: string, variables: Record<string, string>): string {
  return applyConventionTemplate(template, variables).trim();
}

export function buildJiraTicketUrl(ticketKey: string, siteUrl?: string): string {
  const base = (siteUrl ?? process.env.ATLASSIAN_SITE_URL ?? 'https://opsera.atlassian.net')
    .trim()
    .replace(/\/$/, '');
  return `${base}/browse/${ticketKey}`;
}

export const CODEOWNERS_CANDIDATE_PATHS = [
  'CODEOWNERS',
  '.github/CODEOWNERS',
  'docs/CODEOWNERS',
] as const;
