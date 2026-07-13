import { z } from 'zod';
import { repositoryNameSchema, repositoryOwnerSchema } from './repositories.js';

export const SEMVER_BUMP_TYPES = ['major', 'minor', 'patch'] as const;
export const semverBumpTypeSchema = z.enum(SEMVER_BUMP_TYPES);
export type SemverBumpType = z.infer<typeof semverBumpTypeSchema>;

export const AUDIT_SEVERITIES = ['critical', 'high', 'moderate', 'low', 'info'] as const;
export const auditSeveritySchema = z.enum(AUDIT_SEVERITIES);
export type AuditSeverity = z.infer<typeof auditSeveritySchema>;

/** Default block threshold — vulnerabilities at or above this severity block publish. */
export const DEFAULT_AUDIT_SEVERITY_THRESHOLD: AuditSeverity = 'high';

export const PACKAGE_PROPOSAL_STATUSES = [
  'proposed',
  'blocked',
  'confirmed',
  'published',
] as const;
export const packageProposalStatusSchema = z.enum(PACKAGE_PROPOSAL_STATUSES);
export type PackageProposalStatus = z.infer<typeof packageProposalStatusSchema>;

export const packageJsonManifestSchema = z
  .object({
    name: z.string().min(1),
    version: z.string().min(1),
    main: z.union([z.string(), z.record(z.unknown())]).optional(),
    exports: z.unknown().optional(),
    files: z.array(z.string()).optional(),
    private: z.boolean().optional(),
  })
  .passthrough();

export type PackageJsonManifest = z.infer<typeof packageJsonManifestSchema>;

export const packageSnapshotSchema = z.object({
  /** Directory containing package.json, e.g. "packages/shared-utils" or "." */
  packagePath: z.string().min(1),
  packageJson: packageJsonManifestSchema,
  /** Raw .npmignore contents when present. */
  npmignore: z.string().optional(),
  /** Candidate files under the package (relative to package root or repo root). */
  packageFiles: z.array(z.string()).optional(),
  /** npm audit --json style report for this package. */
  auditReport: z.unknown().optional(),
  /**
   * Free-text change hints used by bump heuristics
   * (e.g. "breaking change", "feat:", "fix:").
   */
  changeHints: z.array(z.string()).optional(),
});

export type PackageSnapshot = z.infer<typeof packageSnapshotSchema>;

export const packageDetectRequestSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  changedFiles: z.array(z.string().min(1)).min(1),
  /** Optional snapshots — required for offline/fixture-driven detection. */
  packageSnapshots: z.array(packageSnapshotSchema).optional(),
  severityThreshold: auditSeveritySchema.optional(),
  /** When true, invoke optional LLM bump stub (never required for heuristics). */
  useLlmBumpStub: z.boolean().optional(),
});

export type PackageDetectRequest = z.infer<typeof packageDetectRequestSchema>;

export const vulnerabilityFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: auditSeveritySchema,
  packageName: z.string().min(1),
  path: z.string().optional(),
});

export type VulnerabilityFinding = z.infer<typeof vulnerabilityFindingSchema>;

export const vulnerabilityScanResultSchema = z.object({
  findings: z.array(vulnerabilityFindingSchema),
  severityThreshold: auditSeveritySchema,
  blocked: z.boolean(),
  blockingSeverities: z.array(auditSeveritySchema),
  summary: z.string().min(1),
});

export type VulnerabilityScanResult = z.infer<typeof vulnerabilityScanResultSchema>;

export const allowListValidationSchema = z.object({
  allowedPatterns: z.array(z.string()),
  includedFiles: z.array(z.string()),
  excludedFiles: z.array(z.string()),
  source: z.enum(['files', 'npmignore', 'default']),
});

export type AllowListValidation = z.infer<typeof allowListValidationSchema>;

export const versionBumpAnalysisSchema = z.object({
  bump: semverBumpTypeSchema,
  currentVersion: z.string().min(1),
  proposedVersion: z.string().min(1),
  rationale: z.string().min(1),
  method: z.enum(['heuristic', 'llm_stub']),
});

export type VersionBumpAnalysis = z.infer<typeof versionBumpAnalysisSchema>;

export const packagePublishProposalSchema = z.object({
  id: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  packagePath: z.string().min(1),
  packageName: z.string().min(1),
  currentVersion: z.string().min(1),
  proposedVersion: z.string().min(1),
  bump: semverBumpTypeSchema,
  changelog: z.string().min(1),
  vulnerabilityScan: vulnerabilityScanResultSchema,
  allowList: allowListValidationSchema,
  affectedFiles: z.array(z.string()),
  status: packageProposalStatusSchema,
  /** Present only when status allows confirmation; never auto-publish. */
  confirmationToken: z.string().min(1).optional(),
  confirmedAt: z.string().datetime().optional(),
  publishedAt: z.string().datetime().optional(),
  publishSimulation: z
    .object({
      registry: z.string().min(1),
      tarballName: z.string().min(1),
      simulated: z.literal(true),
    })
    .optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PackagePublishProposal = z.infer<typeof packagePublishProposalSchema>;

export const packageDetectResponseSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  proposals: z.array(packagePublishProposalSchema),
  skippedNonPublishable: z.array(
    z.object({
      packagePath: z.string().min(1),
      reason: z.string().min(1),
    }),
  ),
});

export type PackageDetectResponse = z.infer<typeof packageDetectResponseSchema>;

export const packageProposalIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type PackageProposalIdParams = z.infer<typeof packageProposalIdParamsSchema>;

export const packageConfirmRequestSchema = z.object({
  confirmationToken: z.string().min(1),
});

export type PackageConfirmRequest = z.infer<typeof packageConfirmRequestSchema>;

export const packagePublishRequestSchema = z.object({
  confirmationToken: z.string().min(1),
});

export type PackagePublishRequest = z.infer<typeof packagePublishRequestSchema>;

export const AUDIT_SEVERITY_RANK: Record<AuditSeverity, number> = {
  info: 0,
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

export function severityMeetsThreshold(
  severity: AuditSeverity,
  threshold: AuditSeverity,
): boolean {
  return AUDIT_SEVERITY_RANK[severity] >= AUDIT_SEVERITY_RANK[threshold];
}

/**
 * Apply a semver bump to a version string (major.minor.patch[+prerelease ignored for bump]).
 */
export function applySemverBump(version: string, bump: SemverBumpType): string {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!match) {
    throw new Error(`Invalid semver version: ${version}`);
  }

  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);

  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

/** True when package.json marks a publishable library (main or exports, not private). */
export function isPublishablePackageJson(manifest: {
  main?: unknown;
  exports?: unknown;
  private?: boolean;
}): boolean {
  if (manifest.private === true) {
    return false;
  }
  const hasMain = manifest.main !== undefined && manifest.main !== null && manifest.main !== '';
  const hasExports = manifest.exports !== undefined && manifest.exports !== null;
  return hasMain || hasExports;
}
