import { describe, expect, it } from 'vitest';
import { sampleSmallRepoTree } from './fixtures/codebaseContext.js';
import { codebaseContextSchema } from './codebaseContext.js';

describe('codebase context schemas', () => {
  it('validates a minimal codebase context payload', () => {
    const payload = codebaseContextSchema.parse({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      totalLocEstimate: 1200,
      strategy: 'on-demand',
      fileStructureMap: [],
      namingConventions: [],
      designPatterns: [],
      dependencyGraph: [],
      architecturalLayers: [],
      analyzedAt: '2026-07-11T11:00:00.000Z',
    });

    expect(payload.repo).toBe('auto-dev');
    expect(sampleSmallRepoTree.length).toBeGreaterThan(0);
  });
});
