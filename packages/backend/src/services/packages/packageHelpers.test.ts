import { describe, expect, it } from 'vitest';
import {
  sampleChangedFilesBreaking,
  sampleChangedFilesFeature,
  sampleNonLibraryPackageJson,
  sampleNpmAuditClean,
  sampleNpmAuditWithHigh,
  sampleNpmignore,
  samplePackageSnapshotPrivate,
  samplePackageSnapshotPublishable,
  samplePrivateAppPackageJson,
  samplePublishablePackageJson,
} from '@autodev/shared-types';
import { validateAllowList, patternMatches, parseNpmignore } from './allowList.js';
import { detectAffectedPackages, evaluatePublishability } from './packageDetection.js';
import { evaluateVulnerabilityScan, parseNpmAuditReport } from './npmAuditParser.js';
import {
  analyzeVersionBump,
  determineBumpFromHints,
  determineBumpWithLlmStub,
} from './versionBump.js';

describe('package detection', () => {
  it('detects publishable packages affected by changed files', () => {
    const results = detectAffectedPackages(sampleChangedFilesFeature, [
      samplePackageSnapshotPublishable,
      samplePackageSnapshotPrivate,
    ]);

    const utils = results.find((r) => r.packagePath === 'packages/shared-utils');
    expect(utils?.publishable).toBe(true);
    expect(utils?.snapshot?.packageJson.name).toBe('@autodev/shared-utils');
  });

  it('skips private and non-library packages', () => {
    expect(evaluatePublishability(samplePrivateAppPackageJson).publishable).toBe(false);
    expect(evaluatePublishability(sampleNonLibraryPackageJson).publishable).toBe(false);
    expect(evaluatePublishability(samplePublishablePackageJson).publishable).toBe(true);
  });
});

describe('version bump determination', () => {
  it('maps breaking → major, features → minor, fixes → patch', () => {
    expect(determineBumpFromHints(['BREAKING CHANGE: remove formatDate']).bump).toBe('major');
    expect(determineBumpFromHints(['feat: add formatDate'], sampleChangedFilesFeature).bump).toBe(
      'minor',
    );
    expect(determineBumpFromHints(['fix: null handling']).bump).toBe('patch');
  });

  it('applies bump to proposed version', () => {
    const analysis = analyzeVersionBump({
      currentVersion: '1.2.3',
      changeHints: ['feat: something'],
    });
    expect(analysis.proposedVersion).toBe('1.3.0');
    expect(analysis.method).toBe('heuristic');
  });

  it('optional LLM stub tags method without changing heuristic result', () => {
    const stub = determineBumpWithLlmStub(['feat: add api']);
    expect(stub.bump).toBe('minor');
    expect(stub.rationale).toContain('[llm_stub]');

    const analysis = analyzeVersionBump({
      currentVersion: '2.0.0',
      changeHints: sampleChangedFilesBreaking.map((f) => `breaking remove in ${f}`),
      useLlmStub: true,
    });
    expect(analysis.bump).toBe('major');
    expect(analysis.method).toBe('llm_stub');
    expect(analysis.proposedVersion).toBe('3.0.0');
  });
});

describe('npm audit parsing', () => {
  it('parses clean audit as non-blocking', () => {
    expect(parseNpmAuditReport(sampleNpmAuditClean)).toEqual([]);
    const scan = evaluateVulnerabilityScan(sampleNpmAuditClean, 'high');
    expect(scan.blocked).toBe(false);
    expect(scan.findings).toHaveLength(0);
  });

  it('blocks when findings meet severity threshold', () => {
    const findings = parseNpmAuditReport(sampleNpmAuditWithHigh);
    expect(findings.some((f) => f.severity === 'high')).toBe(true);

    const blocked = evaluateVulnerabilityScan(sampleNpmAuditWithHigh, 'high');
    expect(blocked.blocked).toBe(true);
    expect(blocked.summary).toContain('blocked');

    const permissive = evaluateVulnerabilityScan(sampleNpmAuditWithHigh, 'critical');
    expect(permissive.blocked).toBe(false);
  });
});

describe('allow-list validation', () => {
  it('uses package.json files field as allow-list', () => {
    const result = validateAllowList({
      packagePath: 'packages/shared-utils',
      filesField: ['dist', 'README.md'],
      packageFiles: [
        'packages/shared-utils/dist/index.js',
        'packages/shared-utils/README.md',
        'packages/shared-utils/.env',
        'packages/shared-utils/src/format.ts',
      ],
    });

    expect(result.source).toBe('files');
    expect(result.includedFiles).toContain('packages/shared-utils/dist/index.js');
    expect(result.includedFiles).toContain('packages/shared-utils/README.md');
    expect(result.excludedFiles).toContain('packages/shared-utils/.env');
    expect(result.excludedFiles).toContain('packages/shared-utils/src/format.ts');
  });

  it('falls back to .npmignore when files field is absent', () => {
    expect(parseNpmignore(sampleNpmignore)).toContain('.env');
    expect(patternMatches('secrets/token.pem', 'secrets')).toBe(true);

    const result = validateAllowList({
      packagePath: 'packages/shared-utils',
      npmignore: sampleNpmignore,
      packageFiles: [
        'packages/shared-utils/dist/index.js',
        'packages/shared-utils/.env',
        'packages/shared-utils/src/format.ts',
      ],
    });

    expect(result.source).toBe('npmignore');
    expect(result.includedFiles).toContain('packages/shared-utils/dist/index.js');
    expect(result.excludedFiles).toContain('packages/shared-utils/.env');
    expect(result.excludedFiles).toContain('packages/shared-utils/src/format.ts');
  });
});
