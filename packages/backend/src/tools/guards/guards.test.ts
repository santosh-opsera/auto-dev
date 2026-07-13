import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  findForbiddenPaths,
  findSourceTreeViolations,
  formatForbiddenPathErrors,
  isDotEnvPath,
  isNodeModulesPath,
} from './forbiddenPaths.js';
import {
  collectBlockingVulnerabilities,
  formatAuditBlockMessage,
  parseNpmAuditJson,
  shouldBlockAudit,
} from './npmAuditGuard.js';
import {
  filterFindingsByThreshold,
  formatSastBlockMessage,
  parseSemgrepJson,
  scanSourceWithJsRules,
} from './sastScan.js';
import { runPreCommitGuard } from './preCommitGuard.js';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), 'utf8');
}

function readPathList(name: string): string[] {
  return readFixture(name)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

describe('forbiddenPaths', () => {
  it('detects node_modules in staged path lists', () => {
    const paths = readPathList('staged-paths-node-modules.txt');
    const hits = findForbiddenPaths(paths);
    expect(hits.some((h) => h.kind === 'node_modules')).toBe(true);
    expect(isNodeModulesPath('packages/backend/src/node_modules/lodash/index.js')).toBe(true);
    expect(isNodeModulesPath('packages/backend/src/index.ts')).toBe(false);
  });

  it('detects .env files but allows .env.example', () => {
    const paths = readPathList('staged-paths-env.txt');
    const hits = findForbiddenPaths(paths);
    expect(hits.every((h) => h.kind === 'dotenv')).toBe(true);
    expect(hits.map((h) => h.path)).not.toContain('.env.example');
    expect(isDotEnvPath('.env.example')).toBe(false);
    expect(isDotEnvPath('packages/frontend/src/.env.local')).toBe(true);
  });

  it('reports clean staged path lists as empty', () => {
    expect(findForbiddenPaths(readPathList('staged-paths-clean.txt'))).toEqual([]);
  });

  it('flags source-tree violations but ignores root node_modules paths outside src', () => {
    const violations = findSourceTreeViolations(readPathList('source-tree-violations.txt'));
    expect(violations.length).toBeGreaterThan(0);
    expect(findSourceTreeViolations(readPathList('source-tree-clean.txt'))).toEqual([]);
    // Root node_modules is not under src — build guard path list would not include it via src walk
    expect(findSourceTreeViolations(['node_modules/express/index.js'])).toEqual([]);
  });

  it('formats clear remediation messages', () => {
    const message = formatForbiddenPathErrors(
      findForbiddenPaths(readPathList('staged-paths-node-modules.txt')),
    );
    expect(message).toContain('blocked');
    expect(message).toContain('Fix:');
    expect(message).toContain('node_modules');
  });
});

describe('npmAuditGuard', () => {
  it('parses clean audit reports without blocking', () => {
    const report = parseNpmAuditJson(readFixture('npm-audit-clean.json'));
    expect(shouldBlockAudit(report)).toBe(false);
    expect(collectBlockingVulnerabilities(report)).toEqual([]);
  });

  it('blocks on high/critical vulnerabilities and formats details', () => {
    const report = parseNpmAuditJson(readFixture('npm-audit-high.json'));
    expect(shouldBlockAudit(report)).toBe(true);
    const vulns = collectBlockingVulnerabilities(report);
    expect(vulns.map((v) => v.name).sort()).toEqual(['lodash', 'minimist']);
    const message = formatAuditBlockMessage(vulns);
    expect(message).toContain('high/critical');
    expect(message).toContain('lodash');
    expect(message).toContain('minimist');
    expect(message).toContain('Fix:');
  });
});

describe('sastScan', () => {
  it('returns no findings for clean fixtures', () => {
    const source = readFixture('sast-clean-sample.ts.txt');
    expect(scanSourceWithJsRules('clean.ts', source)).toEqual([]);
  });

  it('detects policy violations in fixture source', () => {
    const source = readFixture('sast-violations-sample.ts.txt');
    const findings = scanSourceWithJsRules('evil.ts', source);
    const ids = new Set(findings.map((f) => f.ruleId));
    expect(ids.has('no-eval')).toBe(true);
    expect(ids.has('no-new-function')).toBe(true);
    expect(ids.has('no-innerhtml')).toBe(true);
    expect(ids.has('no-document-write')).toBe(true);
    expect(ids.has('no-hardcoded-secret-assignment')).toBe(true);
    expect(ids.has('no-child-process-exec')).toBe(true);
  });

  it('filters by severity threshold and formats block messages', () => {
    const sample = JSON.parse(readFixture('sast-findings-sample.json')) as Array<{
      file: string;
      line: number;
      ruleId: string;
      severity: 'critical' | 'high' | 'medium' | 'low';
      message: string;
      engine: 'js' | 'semgrep';
    }>;
    const blocking = filterFindingsByThreshold(sample, 'high');
    expect(blocking).toHaveLength(2);
    expect(filterFindingsByThreshold(sample, 'critical')).toHaveLength(1);
    expect(formatSastBlockMessage(blocking, 'high')).toContain('no-eval');
  });

  it('parses semgrep JSON without requiring the semgrep binary', () => {
    const findings = parseSemgrepJson(
      JSON.stringify({
        results: [
          {
            path: 'a.ts',
            start: { line: 4 },
            check_id: 'javascript.lang.security.audit.eval-detected',
            extra: { severity: 'ERROR', message: 'eval detected' },
          },
        ],
      }),
    );
    expect(findings).toEqual([
      {
        file: 'a.ts',
        line: 4,
        ruleId: 'javascript.lang.security.audit.eval-detected',
        severity: 'critical',
        message: 'eval detected',
        engine: 'semgrep',
      },
    ]);
  });
});

describe('runPreCommitGuard', () => {
  it('passes for clean staged paths with a clean audit report', () => {
    const result = runPreCommitGuard({
      repoRoot: fixturesDir,
      stagedPaths: readPathList('staged-paths-clean.txt'),
      auditReport: parseNpmAuditJson(readFixture('npm-audit-clean.json')),
      skipSemgrep: true,
      readFile: (absolutePath) => {
        if (absolutePath.endsWith('sast-clean-sample.ts.txt')) {
          return readFixture('sast-clean-sample.ts.txt');
        }
        return 'export const ok = true;\n';
      },
    });
    expect(result.ok).toBe(true);
    expect(result.messages).toEqual([]);
  });

  it('fails with clear messages when node_modules are staged', () => {
    const result = runPreCommitGuard({
      repoRoot: fixturesDir,
      stagedPaths: readPathList('staged-paths-node-modules.txt'),
      skipAudit: true,
      skipSemgrep: true,
      readFile: () => 'export {};\n',
    });
    expect(result.ok).toBe(false);
    expect(result.messages.join('\n')).toContain('node_modules');
  });

  it('fails when audit reports high/critical issues', () => {
    const result = runPreCommitGuard({
      repoRoot: fixturesDir,
      stagedPaths: readPathList('staged-paths-clean.txt'),
      auditReport: parseNpmAuditJson(readFixture('npm-audit-high.json')),
      skipSemgrep: true,
      readFile: () => 'export {};\n',
    });
    expect(result.ok).toBe(false);
    expect(result.auditBlocked).toBe(true);
    expect(result.messages.join('\n')).toContain('npm audit');
  });

  it('fails when SAST findings exceed threshold', () => {
    const result = runPreCommitGuard({
      repoRoot: fixturesDir,
      stagedPaths: ['evil.ts'],
      skipAudit: true,
      skipSemgrep: true,
      sastThreshold: 'high',
      readFile: () => readFixture('sast-violations-sample.ts.txt'),
    });
    expect(result.ok).toBe(false);
    expect(result.sastFindings.length).toBeGreaterThan(0);
    expect(result.messages.join('\n')).toContain('SAST');
  });
});
