import { describe, expect, it } from 'vitest';
import {
  sampleSmallRepoFiles,
  sampleSmallRepoTree,
} from '@autodev/shared-types';
import { analyzeCodebase, computeTreeFingerprint } from './codebaseAnalysisEngine.js';

describe('codebaseAnalysisEngine', () => {
  it('builds a codebase context from repository tree and file contents', () => {
    const context = analyzeCodebase({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      tree: sampleSmallRepoTree,
      fileContents: sampleSmallRepoFiles,
    });

    expect(context.strategy).toBe('on-demand');
    expect(context.architecturalLayers.some((layer) => layer.layer === 'services')).toBe(true);
    expect(context.designPatterns.some((pattern) => pattern.pattern === 'repository')).toBe(true);
    expect(context.dependencyGraph.length).toBeGreaterThan(0);
    expect(context.namingConventions.some((item) => item.category === 'test')).toBe(true);
  });

  it('selects indexed strategy for large repositories', () => {
    const largeTree = Array.from({ length: 300 }, (_, index) => ({
      path: `src/file-${index}.ts`,
      type: 'file' as const,
      size: 50,
    }));

    const context = analyzeCodebase({
      owner: 'org',
      repo: 'large-repo',
      branch: 'main',
      tree: largeTree,
      fileContents: {},
    });

    expect(context.strategy).toBe('indexed');
    expect(context.totalLocEstimate).toBeGreaterThanOrEqual(10_000);
  });

  it('computes stable tree fingerprints', () => {
    const first = computeTreeFingerprint(sampleSmallRepoTree);
    const second = computeTreeFingerprint(sampleSmallRepoTree);
    expect(first).toBe(second);
  });
});
