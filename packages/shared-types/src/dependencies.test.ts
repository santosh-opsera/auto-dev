import { describe, expect, it } from 'vitest';
import {
  buildChangelogLink,
  dependencyScanRequestSchema,
  dependencyUpdateProposalSchema,
  isVersionOutdated,
  packageBumpNotifyRequestSchema,
  packageConsumersResponseSchema,
  parseComparableSemver,
} from './dependencies.js';
import {
  sampleDependencyScanRequest,
  sampleDependencyUpdateProposal,
  samplePackageBumpNotifyRequest,
  sampleSharedUtilsConsumers,
} from './fixtures/dependencies.js';

describe('dependency schemas', () => {
  it('validates scan request and proposal fixtures', () => {
    expect(dependencyScanRequestSchema.safeParse(sampleDependencyScanRequest).success).toBe(
      true,
    );
    expect(dependencyUpdateProposalSchema.safeParse(sampleDependencyUpdateProposal).success).toBe(
      true,
    );
    expect(packageBumpNotifyRequestSchema.safeParse(samplePackageBumpNotifyRequest).success).toBe(
      true,
    );
    expect(
      packageConsumersResponseSchema.safeParse({
        packageName: '@autodev/shared-utils',
        consumers: sampleSharedUtilsConsumers,
        count: sampleSharedUtilsConsumers.length,
      }).success,
    ).toBe(true);
  });

  it('requires at least one repository snapshot', () => {
    expect(dependencyScanRequestSchema.safeParse({ repositories: [] }).success).toBe(false);
  });
});

describe('semver comparison helpers', () => {
  it('parses range-prefixed versions', () => {
    expect(parseComparableSemver('^1.2.3')).toEqual([1, 2, 3]);
    expect(parseComparableSemver('~2.0.1')).toEqual([2, 0, 1]);
    expect(parseComparableSemver('>=1.0.0')).toEqual([1, 0, 0]);
    expect(parseComparableSemver('v3.1.4')).toEqual([3, 1, 4]);
  });

  it('detects outdated consumer versions', () => {
    expect(isVersionOutdated('^1.2.3', '1.3.0')).toBe(true);
    expect(isVersionOutdated('1.2.3', '1.2.3')).toBe(false);
    expect(isVersionOutdated('2.0.0', '1.9.9')).toBe(false);
    expect(isVersionOutdated('1.2.3', '1.2.4')).toBe(true);
  });

  it('builds changelog links', () => {
    expect(buildChangelogLink('@autodev/shared-utils', '1.3.0')).toContain(
      encodeURIComponent('@autodev/shared-utils'),
    );
    expect(buildChangelogLink('@autodev/shared-utils', '1.3.0')).toContain('1.3.0');
  });
});
