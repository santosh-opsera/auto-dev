import { describe, expect, it } from 'vitest';
import {
  sampleCursorConventions,
  sampleCursorImplementationResult,
  sampleCursorImplementationResultBadConventions,
  sampleCursorImplementationResultOutOfScope,
  sampleImplementationChunks,
} from '@autodev/shared-types';
import {
  commitMessageMatchesFormat,
  validateConventionCompliance,
  validateCursorImplementationResult,
  validateResultAgainstChunkScope,
} from './resultValidator.js';

describe('resultValidator', () => {
  const expectedFiles = sampleImplementationChunks[0]!.scope.files;

  it('flags unexpected files outside chunk scope', () => {
    const scope = validateResultAgainstChunkScope(
      sampleCursorImplementationResultOutOfScope,
      expectedFiles,
    );

    expect(scope.valid).toBe(false);
    expect(scope.unexpectedFiles).toContain('packages/frontend/src/App.tsx');
  });

  it('accepts results that stay within chunk scope', () => {
    const scope = validateResultAgainstChunkScope(
      sampleCursorImplementationResult,
      expectedFiles,
    );

    expect(scope.valid).toBe(true);
    expect(scope.unexpectedFiles).toEqual([]);
  });

  it('validates branch and commit against convention settings (never hardcoded)', () => {
    const customConventions = {
      ...sampleCursorConventions,
      branchNamingPattern: '^wo/WO-\\d+-[a-z0-9-]+$',
      commitMessageFormat: '[WO-{ticketKey}] {description}',
    };

    const matching = validateConventionCompliance(
      {
        ...sampleCursorImplementationResult,
        branchName: 'wo/WO-027-cursor-bridge',
        commitMessage: '[WO-OPL-1234] Add Cursor bridge',
      },
      customConventions,
      { ticketKey: 'OPL-1234' },
    );

    expect(matching.valid).toBe(true);
    expect(matching.branchNamingPattern).toBe(customConventions.branchNamingPattern);
    expect(matching.commitMessageFormat).toBe(customConventions.commitMessageFormat);

    const failing = validateConventionCompliance(
      sampleCursorImplementationResultBadConventions,
      customConventions,
      { ticketKey: 'OPL-1234' },
    );

    expect(failing.valid).toBe(false);
    expect(failing.branchValid).toBe(false);
    expect(failing.commitValid).toBe(false);
    expect(failing.issues.length).toBeGreaterThan(0);
  });

  it('matches commit messages from configured templates', () => {
    expect(
      commitMessageMatchesFormat(
        'OPL-1234: Add types',
        '{ticketKey}: {description}',
        { ticketKey: 'OPL-1234' },
      ),
    ).toBe(true);
    expect(
      commitMessageMatchesFormat('fixed stuff', '{ticketKey}: {description}', {
        ticketKey: 'OPL-1234',
      }),
    ).toBe(false);
  });

  it('combines scope and convention validation', () => {
    const validation = validateCursorImplementationResult({
      result: sampleCursorImplementationResult,
      expectedFiles,
      conventions: sampleCursorConventions,
      ticketKey: 'OPL-1234',
    });

    expect(validation.scope.valid).toBe(true);
    expect(validation.conventions.valid).toBe(true);
  });
});
