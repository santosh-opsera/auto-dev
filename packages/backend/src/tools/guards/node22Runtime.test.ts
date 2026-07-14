import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findMonorepoRoot, moduleDir } from './repoRoot.js';

const repoRoot = findMonorepoRoot(moduleDir(import.meta.url));

describe('Node 22 runtime pins (WO-026)', () => {
  it('pins Node 22 via .nvmrc and package.json engines', () => {
    const nvmrc = readFileSync(join(repoRoot, '.nvmrc'), 'utf8').trim();
    expect(nvmrc).toBe('22');

    const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
      engines?: { node?: string };
    };
    expect(pkg.engines?.node).toMatch(/22/);
    expect(pkg.engines?.node).toMatch(/<23/);
  });

  it('encryption uses createCipheriv (not removed createCipher)', async () => {
    const crypto = await import('node:crypto');
    expect(typeof crypto.createCipheriv).toBe('function');
    expect(typeof (crypto as { createCipher?: unknown }).createCipher).toBe('undefined');

    const source = readFileSync(join(repoRoot, 'packages/backend/src/lib/encryption.ts'), 'utf8');
    expect(source).toContain('createCipheriv');
    expect(source).not.toMatch(/\bcreateCipher\b(?!iv)/);
  });

  it('CI workflow enforces Node 22 and rejects node:20 images', () => {
    const workflow = readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8');
    expect(workflow).toMatch(/node-version-file:\s*['"]?\.nvmrc['"]?/);
    expect(workflow).toContain('npm ci');
    expect(workflow).toContain('npm run build');
    expect(workflow).toContain('npm test');
    expect(workflow).toContain('node:20');
    expect(readFileSync(join(repoRoot, '.npmrc'), 'utf8')).toContain('engine-strict=true');
  });
});
