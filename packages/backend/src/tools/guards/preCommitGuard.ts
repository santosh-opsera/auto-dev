/**
 * Pre-commit orchestration: forbidden paths, npm audit, SAST.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findForbiddenPaths,
  formatForbiddenPathErrors,
  type ForbiddenPathHit,
} from './forbiddenPaths.js';
import {
  collectBlockingVulnerabilities,
  formatAuditBlockMessage,
  parseNpmAuditJson,
  shouldBlockAudit,
  type NpmAuditReport,
} from './npmAuditGuard.js';
import {
  filterFindingsByThreshold,
  formatSastBlockMessage,
  isAllowlistedSemgrepFinding,
  parseSeverityThreshold,
  runSemgrepIfAvailable,
  scanFilesWithJsRules,
  type SastFinding,
  type SastSeverity,
} from './sastScan.js';

export type PreCommitGuardOptions = {
  repoRoot: string;
  stagedPaths: string[];
  /** Injected audit report — when omitted, runs `npm audit --json`. */
  auditReport?: NpmAuditReport | null;
  /** Skip live npm audit (tests). */
  skipAudit?: boolean;
  /** Skip semgrep even if present. */
  skipSemgrep?: boolean;
  sastThreshold?: SastSeverity;
  readFile?: (absolutePath: string) => string;
  runAudit?: () => NpmAuditReport;
};

export type PreCommitGuardResult = {
  ok: boolean;
  messages: string[];
  forbiddenHits: ForbiddenPathHit[];
  auditBlocked: boolean;
  sastFindings: SastFinding[];
};

function defaultReadFile(absolutePath: string): string {
  return readFileSync(absolutePath, 'utf8');
}

function defaultRunAudit(repoRoot: string): NpmAuditReport {
  try {
    const raw = execFileSync('npm', ['audit', '--json', '--omit=dev'], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 20 * 1024 * 1024,
    });
    return parseNpmAuditJson(raw);
  } catch (error) {
    const err = error as { stdout?: string | Buffer };
    if (err.stdout) {
      return parseNpmAuditJson(String(err.stdout));
    }
    // If audit itself fails hard, treat as empty (do not block on tooling failure)
    return { vulnerabilities: {}, metadata: { vulnerabilities: { total: 0 } } };
  }
}

export function runPreCommitGuard(options: PreCommitGuardOptions): PreCommitGuardResult {
  const messages: string[] = [];
  const threshold = options.sastThreshold ?? parseSeverityThreshold(process.env.AUTODEV_SAST_THRESHOLD);

  const forbiddenHits = findForbiddenPaths(options.stagedPaths);
  if (forbiddenHits.length > 0) {
    messages.push(formatForbiddenPathErrors(forbiddenHits));
  }

  let auditBlocked = false;
  if (!options.skipAudit) {
    const report =
      options.auditReport !== undefined && options.auditReport !== null
        ? options.auditReport
        : (options.runAudit ?? (() => defaultRunAudit(options.repoRoot)))();

    if (shouldBlockAudit(report)) {
      auditBlocked = true;
      const vulns = collectBlockingVulnerabilities(report);
      messages.push(formatAuditBlockMessage(vulns));
    }
  }

  const readFile = options.readFile ?? defaultReadFile;
  const filePayloads: Array<{ path: string; content: string }> = [];
  for (const staged of options.stagedPaths) {
    if (forbiddenHits.some((h) => h.path === staged.replace(/\\/g, '/'))) {
      continue;
    }
    const absolute = resolve(options.repoRoot, staged);
    try {
      filePayloads.push({ path: staged.replace(/\\/g, '/'), content: readFile(absolute) });
    } catch {
      // binary / missing — skip SAST for that file
    }
  }

  let sastFindings = scanFilesWithJsRules(filePayloads);
  if (!options.skipSemgrep) {
    const scanTargets = filePayloads.map((f) => resolve(options.repoRoot, f.path));
    sastFindings = [...sastFindings, ...runSemgrepIfAvailable(scanTargets)];
  }

  sastFindings = sastFindings.filter((f) => !isAllowlistedSemgrepFinding(f));

  const blockingSast = filterFindingsByThreshold(sastFindings, threshold);
  if (blockingSast.length > 0) {
    messages.push(formatSastBlockMessage(blockingSast, threshold));
  }

  return {
    ok: messages.length === 0,
    messages,
    forbiddenHits,
    auditBlocked,
    sastFindings: blockingSast,
  };
}

/** Read staged paths from `git diff --cached --name-only`. */
export function getStagedPaths(repoRoot: string): string[] {
  try {
    const raw = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
