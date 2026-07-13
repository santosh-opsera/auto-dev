import { describe, expect, it } from 'vitest';
import { sampleDependencyScanRequest } from '@autodev/shared-types';
import { buildDependencyGraph, findConsumers } from './dependencyGraph.js';

describe('dependencyGraph', () => {
  it('builds package→consumers graph from multi-repo package.json fixtures', () => {
    const graph = buildDependencyGraph(sampleDependencyScanRequest.repositories);

    expect(graph.scannedRepositories).toBe(4);
    expect(graph.scannedPackageJsonFiles).toBe(5);
    expect(graph.edgeCount).toBeGreaterThanOrEqual(6);

    const sharedUtils = graph.packages.find((p) => p.packageName === '@autodev/shared-utils');
    expect(sharedUtils).toBeDefined();
    expect(sharedUtils!.consumers).toHaveLength(3);
    expect(sharedUtils!.consumers.map((c) => `${c.owner}/${c.repo}`).sort()).toEqual([
      'acme/api-gateway',
      'acme/api-gateway',
      'acme/web-app',
    ]);
  });

  it('identifies consumers for a bumped package', () => {
    const graph = buildDependencyGraph(sampleDependencyScanRequest.repositories);
    const consumers = findConsumers(graph, '@autodev/shared-utils');

    expect(consumers).toHaveLength(3);
    expect(consumers.every((c) => c.packageName === '@autodev/shared-utils')).toBe(true);
    expect(consumers.some((c) => c.dependencyField === 'peerDependencies')).toBe(true);
    expect(consumers.some((c) => c.packagePath === 'packages/handlers/package.json')).toBe(true);
  });

  it('returns empty consumers for unknown packages', () => {
    const graph = buildDependencyGraph(sampleDependencyScanRequest.repositories);
    expect(findConsumers(graph, '@missing/package')).toEqual([]);
  });

  it('does not treat a package as a consumer of itself via its own name field', () => {
    const graph = buildDependencyGraph(sampleDependencyScanRequest.repositories);
    const producerConsumers = findConsumers(graph, '@autodev/shared-utils').filter(
      (c) => c.owner === 'santosh-opsera' && c.repo === 'auto-dev',
    );
    expect(producerConsumers).toHaveLength(0);
  });
});
