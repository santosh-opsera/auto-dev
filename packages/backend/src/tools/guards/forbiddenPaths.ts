/**
 * Detect forbidden paths that must never be committed or present under source trees.
 * Root-level node_modules/ is expected; packages/<pkg>/src/node_modules and staged
 * node_modules paths are violations.
 */

export type ForbiddenPathKind = 'node_modules' | 'dotenv';

export type ForbiddenPathHit = {
  path: string;
  kind: ForbiddenPathKind;
  reason: string;
  fix: string;
};

const NODE_MODULES_SEGMENT = /(^|\/)node_modules(\/|$)/;
const DOTENV_FILE = /(^|\/)\.env(\..+)?$/;

/** True when path is (or is under) a node_modules directory. */
export function isNodeModulesPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  return NODE_MODULES_SEGMENT.test(normalized);
}

/** True for .env / .env.* files (not .env.example). */
export function isDotEnvPath(filePath: string): boolean {
  const normalized = normalizePath(filePath);
  if (normalized.endsWith('.env.example') || normalized.endsWith('/.env.example')) {
    return false;
  }
  return DOTENV_FILE.test(normalized);
}

export function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Scan a list of file paths (e.g. staged files) for node_modules and .env violations.
 */
export function findForbiddenPaths(paths: readonly string[]): ForbiddenPathHit[] {
  const hits: ForbiddenPathHit[] = [];

  for (const path of paths) {
    const normalized = normalizePath(path);
    if (isNodeModulesPath(normalized)) {
      hits.push({
        path: normalized,
        kind: 'node_modules',
        reason: 'Staged path is inside a node_modules directory.',
        fix: 'Unstage the file (`git reset HEAD -- <path>`) and ensure node_modules/ is gitignored. Install deps with npm install instead of committing packages.',
      });
      continue;
    }
    if (isDotEnvPath(normalized)) {
      hits.push({
        path: normalized,
        kind: 'dotenv',
        reason: 'Staged path is a .env secrets file.',
        fix: 'Unstage the file and keep secrets in environment variables or a secret manager. Use .env.example for non-secret templates.',
      });
    }
  }

  return hits;
}

/**
 * Paths under package source trees (packages/<name>/src/...) that look like
 * vendored node_modules or committed .env files — not the monorepo root node_modules.
 */
export function findSourceTreeViolations(paths: readonly string[]): ForbiddenPathHit[] {
  const hits: ForbiddenPathHit[] = [];

  for (const path of paths) {
    const normalized = normalizePath(path);
    const underPackageSrc = /^packages\/[^/]+\/src\//.test(normalized);
    const underSrc = /(^|\/)src\//.test(normalized);

    if (!underPackageSrc && !underSrc) {
      continue;
    }

    // Allow listing root node_modules via absolute/relative roots that are NOT under src
    if (isNodeModulesPath(normalized)) {
      hits.push({
        path: normalized,
        kind: 'node_modules',
        reason: 'node_modules detected under a source tree (packages/<pkg>/src or **/src).',
        fix: 'Remove the vendored node_modules from the source tree. Dependencies belong in the package root node_modules installed via npm.',
      });
      continue;
    }

    if (isDotEnvPath(normalized)) {
      hits.push({
        path: normalized,
        kind: 'dotenv',
        reason: '.env file detected under a source tree.',
        fix: 'Remove .env from source directories. Keep secrets out of the repo; document keys in .env.example at the package or repo root.',
      });
    }
  }

  return hits;
}

export function formatForbiddenPathErrors(hits: readonly ForbiddenPathHit[]): string {
  if (hits.length === 0) {
    return '';
  }

  const lines = [
    '✖ AutoDev build/commit guard blocked the operation.',
    '',
    'Forbidden paths detected:',
  ];

  for (const hit of hits) {
    lines.push(`  • [${hit.kind}] ${hit.path}`);
    lines.push(`      ${hit.reason}`);
    lines.push(`      Fix: ${hit.fix}`);
  }

  lines.push('');
  lines.push('See WO-040 NPM Build Guard policy for details.');
  return lines.join('\n');
}
