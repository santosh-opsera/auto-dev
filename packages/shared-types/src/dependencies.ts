import { z } from 'zod';
import { repositoryNameSchema, repositoryOwnerSchema } from './repositories.js';

export const DEPENDENCY_FIELDS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
] as const;
export const dependencyFieldSchema = z.enum(DEPENDENCY_FIELDS);
export type DependencyField = z.infer<typeof dependencyFieldSchema>;

export const DEPENDENCY_UPDATE_PROPOSAL_STATUSES = [
  'proposed',
  'accepted',
  'dismissed',
] as const;
export const dependencyUpdateProposalStatusSchema = z.enum(DEPENDENCY_UPDATE_PROPOSAL_STATUSES);
export type DependencyUpdateProposalStatus = z.infer<typeof dependencyUpdateProposalStatusSchema>;

export const consumerPackageJsonSchema = z
  .object({
    name: z.string().min(1).optional(),
    version: z.string().min(1).optional(),
    dependencies: z.record(z.string()).optional(),
    devDependencies: z.record(z.string()).optional(),
    peerDependencies: z.record(z.string()).optional(),
    optionalDependencies: z.record(z.string()).optional(),
  })
  .passthrough();

export type ConsumerPackageJson = z.infer<typeof consumerPackageJsonSchema>;

export const repositoryPackageJsonFileSchema = z.object({
  /** Path to package.json within the repo, e.g. "package.json" or "apps/web/package.json". */
  path: z.string().min(1),
  packageJson: consumerPackageJsonSchema,
});

export type RepositoryPackageJsonFile = z.infer<typeof repositoryPackageJsonFileSchema>;

export const repositoryDependencySnapshotSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  packageJsonFiles: z.array(repositoryPackageJsonFileSchema).min(1),
});

export type RepositoryDependencySnapshot = z.infer<typeof repositoryDependencySnapshotSchema>;

/** Fixture-driven scan of connected repositories to build the dependency graph. */
export const dependencyScanRequestSchema = z.object({
  repositories: z.array(repositoryDependencySnapshotSchema).min(1),
});

export type DependencyScanRequest = z.infer<typeof dependencyScanRequestSchema>;

export const dependencyConsumerSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  packagePath: z.string().min(1),
  dependencyField: dependencyFieldSchema,
  packageName: z.string().min(1),
  currentVersion: z.string().min(1),
});

export type DependencyConsumer = z.infer<typeof dependencyConsumerSchema>;

export const packageDependencyNodeSchema = z.object({
  packageName: z.string().min(1),
  consumers: z.array(dependencyConsumerSchema),
});

export type PackageDependencyNode = z.infer<typeof packageDependencyNodeSchema>;

export const dependencyGraphSchema = z.object({
  packages: z.array(packageDependencyNodeSchema),
  scannedRepositories: z.number().int().nonnegative(),
  scannedPackageJsonFiles: z.number().int().nonnegative(),
  edgeCount: z.number().int().nonnegative(),
});

export type DependencyGraph = z.infer<typeof dependencyGraphSchema>;

export const dependencyScanResponseSchema = z.object({
  graph: dependencyGraphSchema,
});

export type DependencyScanResponse = z.infer<typeof dependencyScanResponseSchema>;

export const dependencyUpdateProposalSchema = z.object({
  id: z.string().min(1),
  packageName: z.string().min(1),
  currentVersion: z.string().min(1),
  proposedVersion: z.string().min(1),
  /** Link to changelog / release notes for the proposed version. */
  changelogLink: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  packagePath: z.string().min(1),
  dependencyField: dependencyFieldSchema,
  status: dependencyUpdateProposalStatusSchema,
  sourceOwner: z.string().min(1).optional(),
  sourceRepo: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type DependencyUpdateProposal = z.infer<typeof dependencyUpdateProposalSchema>;

export const packageBumpNotifyRequestSchema = z.object({
  packageName: z.string().min(1),
  proposedVersion: z.string().min(1),
  changelogLink: z.string().min(1),
  sourceOwner: repositoryOwnerSchema.optional(),
  sourceRepo: repositoryNameSchema.optional(),
});

export type PackageBumpNotifyRequest = z.infer<typeof packageBumpNotifyRequestSchema>;

export const packageBumpNotifyResponseSchema = z.object({
  packageName: z.string().min(1),
  proposedVersion: z.string().min(1),
  consumersIdentified: z.number().int().nonnegative(),
  proposals: z.array(dependencyUpdateProposalSchema),
});

export type PackageBumpNotifyResponse = z.infer<typeof packageBumpNotifyResponseSchema>;

export const packageConsumersResponseSchema = z.object({
  packageName: z.string().min(1),
  consumers: z.array(dependencyConsumerSchema),
  count: z.number().int().nonnegative(),
});

export type PackageConsumersResponse = z.infer<typeof packageConsumersResponseSchema>;

export const outdatedDependenciesResponseSchema = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  outdated: z.array(dependencyUpdateProposalSchema),
  count: z.number().int().nonnegative(),
});

export type OutdatedDependenciesResponse = z.infer<typeof outdatedDependenciesResponseSchema>;

export const packageNameParamsSchema = z.object({
  name: z.string().min(1),
});

export type PackageNameParams = z.infer<typeof packageNameParamsSchema>;

export const dependencyUpdateProposalIdParamsSchema = z.object({
  id: z.string().min(1),
});

export type DependencyUpdateProposalIdParams = z.infer<
  typeof dependencyUpdateProposalIdParamsSchema
>;

export const dependencyUpdateProposalListResponseSchema = z.object({
  proposals: z.array(dependencyUpdateProposalSchema),
});

export type DependencyUpdateProposalListResponse = z.infer<
  typeof dependencyUpdateProposalListResponseSchema
>;

/**
 * Strip common semver range prefixes (^, ~, >=, >, =, v) for comparison.
 * Returns null when the version cannot be parsed as major.minor.patch.
 */
export function parseComparableSemver(version: string): [number, number, number] | null {
  const cleaned = version
    .trim()
    .replace(/^v/i, '')
    .replace(/^[~^>=<\s]+/, '')
    .split(/\s+/)[0]
    ?.split('-')[0];
  if (!cleaned) {
    return null;
  }
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(cleaned);
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** True when `proposed` is strictly newer than `current` (range prefixes ignored). */
export function isVersionOutdated(currentVersion: string, proposedVersion: string): boolean {
  const current = parseComparableSemver(currentVersion);
  const proposed = parseComparableSemver(proposedVersion);
  if (!current || !proposed) {
    return currentVersion.trim() !== proposedVersion.trim();
  }
  for (let i = 0; i < 3; i += 1) {
    if (proposed[i]! > current[i]!) {
      return true;
    }
    if (proposed[i]! < current[i]!) {
      return false;
    }
  }
  return false;
}

/** Build a default changelog / release-notes link for a package version. */
export function buildChangelogLink(packageName: string, version: string): string {
  const encoded = encodeURIComponent(packageName);
  return `https://www.npmjs.com/package/${encoded}?activeTab=versions#${encodeURIComponent(version)}`;
}
