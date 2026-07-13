/**
 * Walk package source trees and collect node_modules / .env violations.
 */

import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  findSourceTreeViolations,
  formatForbiddenPathErrors,
  type ForbiddenPathHit,
} from './forbiddenPaths.js';

const SKIP_DIR_NAMES = new Set(['.git', 'dist', 'coverage', '.turbo', 'playwright-report', 'test-results']);

export type BuildGuardResult = {
  ok: boolean;
  hits: ForbiddenPathHit[];
  scannedRoots: string[];
  message: string;
};

/**
 * Recursively list files under root. When encountering a directory named
 * node_modules, record the directory path itself (do not descend).
 */
export function listSourceTreePaths(rootDir: string, repoRoot: string = rootDir): string[] {
  const results: string[] = [];

  function walk(current: string): void {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const absolute = join(current, entry.name);
      const rel = relative(repoRoot, absolute).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') {
          results.push(rel);
          continue;
        }
        if (SKIP_DIR_NAMES.has(entry.name)) {
          continue;
        }
        walk(absolute);
        continue;
      }

      if (entry.isFile()) {
        results.push(rel);
      }
    }
  }

  try {
    const st = statSync(rootDir);
    if (!st.isDirectory()) {
      return results;
    }
  } catch {
    return results;
  }

  walk(rootDir);
  return results;
}

/**
 * Default scan roots: each packages/<name>/src directory under the monorepo root.
 */
export function defaultSourceRoots(repoRoot: string): string[] {
  const packagesDir = join(repoRoot, 'packages');
  const roots: string[] = [];

  try {
    for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const src = join(packagesDir, entry.name, 'src');
      try {
        if (statSync(src).isDirectory()) {
          roots.push(src);
        }
      } catch {
        // no src — skip
      }
    }
  } catch {
    // no packages dir
  }

  return roots;
}

export function runBuildSourceGuard(
  repoRoot: string,
  sourceRoots: string[] = defaultSourceRoots(repoRoot),
): BuildGuardResult {
  const allPaths: string[] = [];
  for (const root of sourceRoots) {
    allPaths.push(...listSourceTreePaths(root, repoRoot));
  }

  const hits = findSourceTreeViolations(allPaths);
  const message = hits.length > 0 ? formatForbiddenPathErrors(hits) : '';

  return {
    ok: hits.length === 0,
    hits,
    scannedRoots: sourceRoots.map((r) => relative(repoRoot, r).replace(/\\/g, '/') || r),
    message,
  };
}
