import type { ChunkDecompositionDraft } from '@autodev/shared-types';
import { AppError } from '../../utils/errors.js';

export type ChunkDraftNode = ChunkDecompositionDraft['chunks'][number];

/**
 * Topologically sort chunk drafts so dependencies appear before dependents.
 * Throws when the dependency graph contains a cycle or unknown references.
 */
export function orderChunksByDependencies(chunks: ChunkDraftNode[]): ChunkDraftNode[] {
  const byTempId = new Map(chunks.map((chunk) => [chunk.tempId, chunk]));

  for (const chunk of chunks) {
    for (const dep of chunk.dependsOn) {
      if (!byTempId.has(dep)) {
        throw new AppError(
          'ChunkDependencyError',
          `Chunk "${chunk.tempId}" depends on unknown chunk "${dep}".`,
          502,
          'Retry decomposition. Ensure the LLM returns a closed dependency set.',
        );
      }
      if (dep === chunk.tempId) {
        throw new AppError(
          'ChunkDependencyError',
          `Chunk "${chunk.tempId}" cannot depend on itself.`,
          502,
          'Retry decomposition with a valid dependency graph.',
        );
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: ChunkDraftNode[] = [];

  function visit(tempId: string): void {
    if (visited.has(tempId)) {
      return;
    }
    if (visiting.has(tempId)) {
      throw new AppError(
        'ChunkDependencyCycle',
        `Circular dependency detected involving chunk "${tempId}".`,
        502,
        'Retry decomposition. Chunk dependencies must form a DAG.',
      );
    }

    visiting.add(tempId);
    const node = byTempId.get(tempId)!;
    for (const dep of node.dependsOn) {
      visit(dep);
    }
    visiting.delete(tempId);
    visited.add(tempId);
    ordered.push(node);
  }

  for (const chunk of chunks) {
    visit(chunk.tempId);
  }

  return ordered;
}

/**
 * Returns true when every dependency chunk id is present in `completedIds`.
 */
export function dependenciesSatisfied(
  dependencyIds: readonly string[],
  completedIds: ReadonlySet<string>,
): boolean {
  return dependencyIds.every((id) => completedIds.has(id));
}
