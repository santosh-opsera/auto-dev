import {
  applySemverBump,
  type SemverBumpType,
  type VersionBumpAnalysis,
} from '@autodev/shared-types';

const BREAKING_PATTERNS = [
  /\bbreaking\b/i,
  /\bbreaking[- ]change\b/i,
  /\bremoved?\b.+\b(api|export|public)\b/i,
  /\b(api|export|public)\b.+\bremoved?\b/i,
  /^BREAKING CHANGE:/im,
  /\bmajor\b.+\bbump\b/i,
];

const FEATURE_PATTERNS = [
  /\bfeat\b/i,
  /\bfeature\b/i,
  /\badd(ed|s|ing)?\b/i,
  /\bnew\b.+\b(api|export|endpoint|option)\b/i,
  /\bminor\b.+\bbump\b/i,
];

const FIX_PATTERNS = [
  /\bfix\b/i,
  /\bbug\b/i,
  /\bpatch\b/i,
  /\bhotfix\b/i,
  /\btypo\b/i,
];

/**
 * Simple heuristic bump from change hints / file paths.
 * Breaking → major, features → minor, otherwise patch.
 */
export function determineBumpFromHints(
  changeHints: readonly string[],
  changedFiles: readonly string[] = [],
): { bump: SemverBumpType; rationale: string } {
  const corpus = [...changeHints, ...changedFiles].join('\n');

  for (const pattern of BREAKING_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        bump: 'major',
        rationale: 'Breaking API changes detected (major).',
      };
    }
  }

  for (const pattern of FEATURE_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        bump: 'minor',
        rationale: 'New features detected (minor).',
      };
    }
  }

  for (const pattern of FIX_PATTERNS) {
    if (pattern.test(corpus)) {
      return {
        bump: 'patch',
        rationale: 'Bug fixes detected (patch).',
      };
    }
  }

  return {
    bump: 'patch',
    rationale: 'No feature/breaking signals; defaulting to patch.',
  };
}

/**
 * Optional LLM stub — mirrors heuristic output with a distinct method tag.
 * Never required; callers may prefer heuristics alone.
 */
export function determineBumpWithLlmStub(
  changeHints: readonly string[],
  changedFiles: readonly string[] = [],
): { bump: SemverBumpType; rationale: string } {
  const heuristic = determineBumpFromHints(changeHints, changedFiles);
  return {
    bump: heuristic.bump,
    rationale: `[llm_stub] ${heuristic.rationale}`,
  };
}

export function analyzeVersionBump(input: {
  currentVersion: string;
  changeHints: readonly string[];
  changedFiles?: readonly string[];
  useLlmStub?: boolean;
}): VersionBumpAnalysis {
  const result = input.useLlmStub
    ? determineBumpWithLlmStub(input.changeHints, input.changedFiles ?? [])
    : determineBumpFromHints(input.changeHints, input.changedFiles ?? []);

  return {
    bump: result.bump,
    currentVersion: input.currentVersion,
    proposedVersion: applySemverBump(input.currentVersion, result.bump),
    rationale: result.rationale,
    method: input.useLlmStub ? 'llm_stub' : 'heuristic',
  };
}

export function buildChangelog(input: {
  packageName: string;
  proposedVersion: string;
  changeHints: readonly string[];
  rationale: string;
}): string {
  const bullets =
    input.changeHints.length > 0
      ? input.changeHints.map((h) => `- ${h}`).join('\n')
      : '- Internal updates';

  return [
    `## ${input.proposedVersion}`,
    '',
    bullets,
    '',
    `Bump rationale: ${input.rationale}`,
    '',
    `Package: ${input.packageName}`,
  ].join('\n');
}
