/**
 * JS-based SAST checker for staged files.
 * Optionally shells out to semgrep when the binary is available.
 * Unit tests use the JS engine only — semgrep is never required.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

export type SastSeverity = 'critical' | 'high' | 'medium' | 'low';

export type SastFinding = {
  file: string;
  line: number;
  ruleId: string;
  severity: SastSeverity;
  message: string;
  engine: 'js' | 'semgrep';
};

export type SastRule = {
  id: string;
  severity: SastSeverity;
  message: string;
  /** Applied to each line; must not use user input as RegExp source. */
  pattern: RegExp;
  extensions?: readonly string[];
};

const SEVERITY_RANK: Record<SastSeverity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Build rule regexes from string pieces so this file does not self-match. */
function rulePattern(source: string, flags?: string): RegExp {
  return flags ? new RegExp(source, flags) : new RegExp(source);
}

export const DEFAULT_SAST_RULES: readonly SastRule[] = [
  {
    id: 'no-eval',
    severity: 'critical',
    message: 'Dynamic code execution via the global eval API is dangerous and blocked by policy.',
    // Avoid embedding the forbidden call as a contiguous substring in this file.
    pattern: rulePattern(String.raw`\b` + 'ev' + 'al' + String.raw`\s*\(`),
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  },
  {
    id: 'no-new-function',
    severity: 'critical',
    message: 'Constructing functions from strings can execute arbitrary code and is blocked by policy.',
    pattern: rulePattern(String.raw`\bnew\s+` + 'Function' + String.raw`\s*\(`),
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  },
  {
    id: 'no-child-process-exec',
    severity: 'high',
    message:
      'child_process.exec/execSync with a shell string can lead to command injection — prefer execFile with a fixed argv.',
    // Flags exec/execSync shell forms; does not match execFile/execFileSync.
    pattern: rulePattern(String.raw`\bexec(?:Sync)?\s*\(\s*[\`'"]`),
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'],
  },
  {
    id: 'no-innerhtml',
    severity: 'high',
    message: 'Assigning to innerHTML can introduce XSS.',
    pattern: rulePattern(String.raw`\.innerHTML\s*=`),
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'no-document-write',
    severity: 'high',
    message: 'document.write can introduce XSS.',
    pattern: rulePattern(String.raw`\bdocument\.write\s*\(`),
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
  {
    id: 'no-hardcoded-secret-assignment',
    severity: 'high',
    message: 'Possible hardcoded secret assignment detected.',
    pattern: rulePattern(
      String.raw`\b(?:api[_-]?key|secret|password|token|private[_-]?key)\b\s*[:=]\s*['"][^'"]{8,}['"]`,
      'i',
    ),
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.json', '.env'],
  },
  {
    id: 'no-disable-security-eslint',
    severity: 'medium',
    message: 'Disabling security ESLint rules is discouraged.',
    pattern: rulePattern(String.raw`eslint-disable(?:-next-line)?\s+[^\n]*security/`),
    extensions: ['.js', '.jsx', '.ts', '.tsx'],
  },
];

/** Paths where non-literal RegExp is intentional (validated by createSafeRegExp). */
const SEMGREP_ALLOWLIST_PATH_FRAGMENTS = [
  '/safeRegExp.ts',
  '\\safeRegExp.ts',
  '/templateVariables.ts',
  '\\templateVariables.ts',
  '/sastScan.ts',
  '\\sastScan.ts',
];

const SEMGREP_ALLOWLIST_RULE_FRAGMENTS = [
  'detect-non-literal-regexp',
];

export function isAllowlistedSemgrepFinding(finding: SastFinding): boolean {
  const path = finding.file.replace(/\\/g, '/');
  const pathOk = SEMGREP_ALLOWLIST_PATH_FRAGMENTS.some((frag) =>
    path.endsWith(frag.replace(/\\/g, '/')) || path.includes(frag.replace(/\\/g, '/')),
  );
  const ruleOk = SEMGREP_ALLOWLIST_RULE_FRAGMENTS.some((frag) =>
    finding.ruleId.includes(frag),
  );
  return pathOk && ruleOk;
}

export function severityAtOrAbove(
  finding: SastSeverity,
  threshold: SastSeverity,
): boolean {
  return SEVERITY_RANK[finding] >= SEVERITY_RANK[threshold];
}

export function parseSeverityThreshold(value: string | undefined): SastSeverity {
  const lower = (value ?? 'high').toLowerCase();
  if (lower === 'critical' || lower === 'high' || lower === 'medium' || lower === 'low') {
    return lower;
  }
  return 'high';
}

function extensionOf(filePath: string): string {
  const base = filePath.replace(/\\/g, '/');
  const idx = base.lastIndexOf('.');
  if (idx === -1) {
    return '';
  }
  return base.slice(idx).toLowerCase();
}

export function scanSourceWithJsRules(
  filePath: string,
  source: string,
  rules: readonly SastRule[] = DEFAULT_SAST_RULES,
): SastFinding[] {
  const ext = extensionOf(filePath);
  const findings: SastFinding[] = [];
  const lines = source.split(/\r?\n/);

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    for (const rule of rules) {
      if (rule.extensions && !rule.extensions.includes(ext)) {
        continue;
      }
      if (rule.pattern.test(line)) {
        findings.push({
          file: filePath,
          line: i + 1,
          ruleId: rule.id,
          severity: rule.severity,
          message: rule.message,
          engine: 'js',
        });
      }
      // Reset lastIndex for global regexes (none today, defensive)
      rule.pattern.lastIndex = 0;
    }
  }

  return findings;
}

export function scanFilesWithJsRules(
  files: ReadonlyArray<{ path: string; content: string }>,
  rules: readonly SastRule[] = DEFAULT_SAST_RULES,
): SastFinding[] {
  return files.flatMap((file) => scanSourceWithJsRules(file.path, file.content, rules));
}

export function filterFindingsByThreshold(
  findings: readonly SastFinding[],
  threshold: SastSeverity,
): SastFinding[] {
  return findings.filter((f) => severityAtOrAbove(f.severity, threshold));
}

export function formatSastBlockMessage(
  findings: readonly SastFinding[],
  threshold: SastSeverity,
): string {
  if (findings.length === 0) {
    return '';
  }

  const lines = [
    `✖ SAST scan found ${findings.length} issue(s) at or above threshold "${threshold}" — commit blocked.`,
    '',
    'Findings:',
  ];

  for (const finding of findings) {
    lines.push(
      `  • [${finding.severity}] ${finding.file}:${finding.line} (${finding.ruleId}, ${finding.engine})`,
    );
    lines.push(`      ${finding.message}`);
  }

  lines.push('');
  lines.push('Fix: remediate or remove the unsafe pattern, then stage the corrected files.');
  lines.push(
    `      To temporarily lower the threshold (not recommended), set AUTODEV_SAST_THRESHOLD (critical|high|medium|low).`,
  );
  return lines.join('\n');
}

export function isSemgrepAvailable(
  runner: (cmd: string, args: string[]) => { status: number } = defaultWhichRunner,
): boolean {
  try {
    const result = runner('semgrep', ['--version']);
    return result.status === 0;
  } catch {
    return false;
  }
}

function defaultWhichRunner(cmd: string, args: string[]): { status: number } {
  try {
    execFileSync(cmd, args, { stdio: 'pipe' });
    return { status: 0 };
  } catch {
    return { status: 1 };
  }
}

export type SemgrepJsonReport = {
  results?: Array<{
    path?: string;
    start?: { line?: number };
    check_id?: string;
    extra?: {
      severity?: string;
      message?: string;
    };
  }>;
};

export function parseSemgrepJson(raw: string): SastFinding[] {
  let report: SemgrepJsonReport;
  try {
    report = JSON.parse(raw) as SemgrepJsonReport;
  } catch {
    return [];
  }

  return (report.results ?? []).map((result) => {
    const severityRaw = (result.extra?.severity ?? 'WARNING').toUpperCase();
    let severity: SastSeverity = 'medium';
    if (severityRaw === 'ERROR' || severityRaw === 'CRITICAL') {
      severity = 'critical';
    } else if (severityRaw === 'WARNING' || severityRaw === 'HIGH') {
      severity = 'high';
    } else if (severityRaw === 'INFO' || severityRaw === 'LOW') {
      severity = 'low';
    }

    return {
      file: result.path ?? 'unknown',
      line: result.start?.line ?? 1,
      ruleId: result.check_id ?? 'semgrep',
      severity,
      message: result.extra?.message ?? 'Semgrep finding',
      engine: 'semgrep' as const,
    };
  });
}

/**
 * Run semgrep on the given files when available. Returns [] if semgrep is missing
 * or the run fails — JS rules remain the guaranteed baseline.
 */
export function runSemgrepIfAvailable(
  filePaths: readonly string[],
  options: {
    available?: boolean;
    exec?: (files: readonly string[]) => string;
  } = {},
): SastFinding[] {
  const available = options.available ?? isSemgrepAvailable();
  if (!available || filePaths.length === 0) {
    return [];
  }

  try {
    const raw =
      options.exec?.(filePaths) ??
      execFileSync(
        'semgrep',
        ['--config', 'auto', '--json', '--quiet', '--error', ...filePaths],
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          maxBuffer: 10 * 1024 * 1024,
        },
      );
    return parseSemgrepJson(typeof raw === 'string' ? raw : String(raw));
  } catch (error) {
    // semgrep exits non-zero when findings exist — stdout may still have JSON
    const err = error as { stdout?: string | Buffer; status?: number };
    if (err.stdout) {
      return parseSemgrepJson(String(err.stdout));
    }
    return [];
  }
}

export function readTextFileIfExists(filePath: string): string | null {
  if (!existsSync(filePath)) {
    return null;
  }
  return readFileSync(filePath, 'utf8');
}
