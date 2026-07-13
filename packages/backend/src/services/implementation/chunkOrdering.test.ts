import { describe, expect, it } from 'vitest';
import { AppError } from '../../utils/errors.js';
import {
  dependenciesSatisfied,
  orderChunksByDependencies,
} from './chunkOrdering.js';
import type { ChunkDraftNode } from './chunkOrdering.js';

function draft(
  tempId: string,
  dependsOn: string[] = [],
): ChunkDraftNode {
  return {
    tempId,
    name: tempId,
    description: `Chunk ${tempId}`,
    scope: { files: [], modules: [] },
    dependsOn,
    estimatedComplexity: 'low',
  };
}

describe('chunkOrdering', () => {
  it('orders chunks so dependencies come first', () => {
    const ordered = orderChunksByDependencies([
      draft('c3', ['c2']),
      draft('c1'),
      draft('c2', ['c1']),
    ]);

    expect(ordered.map((chunk) => chunk.tempId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('rejects unknown dependency references', () => {
    expect(() => orderChunksByDependencies([draft('c1', ['missing'])])).toThrow(AppError);
  });

  it('rejects dependency cycles', () => {
    expect(() =>
      orderChunksByDependencies([draft('c1', ['c2']), draft('c2', ['c1'])]),
    ).toThrow(AppError);
  });

  it('checks dependency completion', () => {
    expect(dependenciesSatisfied(['a', 'b'], new Set(['a', 'b']))).toBe(true);
    expect(dependenciesSatisfied(['a', 'b'], new Set(['a']))).toBe(false);
  });
});
