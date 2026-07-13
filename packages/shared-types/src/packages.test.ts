import { describe, expect, it } from 'vitest';
import {
  applySemverBump,
  isPublishablePackageJson,
  packageConfirmRequestSchema,
  packageDetectRequestSchema,
  packageDetectResponseSchema,
  packagePublishProposalSchema,
  packagePublishRequestSchema,
  severityMeetsThreshold,
} from './packages.js';
import {
  sampleDetectRequest,
  sampleNonLibraryPackageJson,
  samplePackagePublishProposal,
  samplePrivateAppPackageJson,
  samplePublishablePackageJson,
} from './fixtures/packages.js';

describe('package publish schemas', () => {
  it('validates detect request and proposal fixtures', () => {
    expect(packageDetectRequestSchema.safeParse(sampleDetectRequest).success).toBe(true);
    expect(packagePublishProposalSchema.safeParse(samplePackagePublishProposal).success).toBe(
      true,
    );
    expect(
      packageDetectResponseSchema.safeParse({
        owner: sampleDetectRequest.owner,
        repo: sampleDetectRequest.repo,
        proposals: [samplePackagePublishProposal],
        skippedNonPublishable: [],
      }).success,
    ).toBe(true);
  });

  it('requires confirmationToken on confirm and publish', () => {
    expect(packageConfirmRequestSchema.safeParse({ confirmationToken: 'tok' }).success).toBe(
      true,
    );
    expect(packageConfirmRequestSchema.safeParse({}).success).toBe(false);
    expect(packagePublishRequestSchema.safeParse({ confirmationToken: 'tok' }).success).toBe(
      true,
    );
    expect(packagePublishRequestSchema.safeParse({ confirmationToken: '' }).success).toBe(false);
  });

  it('rejects empty changedFiles', () => {
    expect(
      packageDetectRequestSchema.safeParse({
        owner: 'acme',
        repo: 'widgets',
        changedFiles: [],
      }).success,
    ).toBe(false);
  });
});

describe('publishable package detection helpers', () => {
  it('requires main or exports and rejects private packages', () => {
    expect(isPublishablePackageJson(samplePublishablePackageJson)).toBe(true);
    expect(isPublishablePackageJson(samplePrivateAppPackageJson)).toBe(false);
    expect(isPublishablePackageJson(sampleNonLibraryPackageJson)).toBe(false);
    expect(isPublishablePackageJson({ main: './index.js' })).toBe(true);
    expect(isPublishablePackageJson({ exports: { '.': './index.js' } })).toBe(true);
  });
});

describe('semver helpers', () => {
  it('bumps major/minor/patch correctly', () => {
    expect(applySemverBump('1.2.3', 'major')).toBe('2.0.0');
    expect(applySemverBump('1.2.3', 'minor')).toBe('1.3.0');
    expect(applySemverBump('1.2.3', 'patch')).toBe('1.2.4');
  });

  it('ranks audit severities for thresholds', () => {
    expect(severityMeetsThreshold('high', 'high')).toBe(true);
    expect(severityMeetsThreshold('critical', 'high')).toBe(true);
    expect(severityMeetsThreshold('moderate', 'high')).toBe(false);
    expect(severityMeetsThreshold('low', 'moderate')).toBe(false);
  });
});
