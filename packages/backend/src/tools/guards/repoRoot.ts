import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Walk upward until package.json declares workspaces (monorepo root). */
export function findMonorepoRoot(startDir: string = process.cwd()): string {
  let current = resolve(startDir);
  for (;;) {
    const pkgPath = resolve(current, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { workspaces?: unknown };
        if (pkg.workspaces) {
          return current;
        }
      } catch {
        // continue walking
      }
    }
    const parent = dirname(current);
    if (parent === current) {
      return resolve(startDir);
    }
    current = parent;
  }
}

export function moduleDir(importMetaUrl: string): string {
  return dirname(fileURLToPath(importMetaUrl));
}
