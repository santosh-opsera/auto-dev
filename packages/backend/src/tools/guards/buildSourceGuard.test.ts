import { describe, expect, it } from 'vitest';
import { findMonorepoRoot } from './repoRoot.js';
import { defaultSourceRoots, listSourceTreePaths, runBuildSourceGuard } from './buildSourceGuard.js';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('buildSourceGuard', () => {
  it('passes when source trees have no node_modules or .env', () => {
    const root = mkdtempSync(join(tmpdir(), 'autodev-build-guard-'));
    try {
      const src = join(root, 'packages', 'demo', 'src');
      mkdirSync(src, { recursive: true });
      writeFileSync(join(src, 'index.ts'), 'export {};\n');
      // Root node_modules must NOT fail the guard
      mkdirSync(join(root, 'node_modules', 'left-pad'), { recursive: true });
      writeFileSync(join(root, 'node_modules', 'left-pad', 'index.js'), 'module.exports = {};\n');

      const result = runBuildSourceGuard(root, [src]);
      expect(result.ok).toBe(true);
      expect(result.hits).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('fails when node_modules or .env appear under package src trees', () => {
    const root = mkdtempSync(join(tmpdir(), 'autodev-build-guard-bad-'));
    try {
      const src = join(root, 'packages', 'demo', 'src');
      mkdirSync(join(src, 'node_modules', 'evil'), { recursive: true });
      writeFileSync(join(src, 'node_modules', 'evil', 'index.js'), 'module.exports = {};\n');
      writeFileSync(join(src, '.env'), 'SECRET=1\n');

      const result = runBuildSourceGuard(root, [src]);
      expect(result.ok).toBe(false);
      expect(result.hits.some((h) => h.kind === 'node_modules')).toBe(true);
      expect(result.hits.some((h) => h.kind === 'dotenv')).toBe(true);
      expect(result.message).toContain('Fix:');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('lists node_modules dirs without descending into them', () => {
    const root = mkdtempSync(join(tmpdir(), 'autodev-list-paths-'));
    try {
      const src = join(root, 'src');
      mkdirSync(join(src, 'node_modules', 'pkg'), { recursive: true });
      writeFileSync(join(src, 'node_modules', 'pkg', 'index.js'), '');
      writeFileSync(join(src, 'ok.ts'), '');
      const paths = listSourceTreePaths(src, root);
      expect(paths).toContain('src/ok.ts');
      expect(paths).toContain('src/node_modules');
      expect(paths.some((p) => p.includes('pkg/index.js'))).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('resolves default source roots under packages/<name>/src', () => {
    const root = findMonorepoRoot();
    const roots = defaultSourceRoots(root);
    expect(roots.some((r) => r.replace(/\\/g, '/').endsWith('packages/backend/src'))).toBe(true);
  });
});
