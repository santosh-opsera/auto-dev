import type { FileStructureNode } from '@autodev/shared-types';
import type { RepositoryTreeEntry } from '@autodev/shared-types';

export function buildFileStructureMap(tree: RepositoryTreeEntry[]): FileStructureNode[] {
  const root: FileStructureNode[] = [];

  for (const entry of tree.filter((item) => item.type === 'file' || item.type === 'dir')) {
    const segments = entry.path.split('/');
    let currentLevel = root;

    for (let index = 0; index < segments.length; index += 1) {
      const segment = segments[index]!;
      const path = segments.slice(0, index + 1).join('/');
      const isLeaf = index === segments.length - 1;
      const type = isLeaf ? entry.type : 'dir';

      let node = currentLevel.find((item) => item.name === segment);
      if (!node) {
        node = { name: segment, path, type, ...(type === 'dir' ? { children: [] } : {}) };
        currentLevel.push(node);
      }

      if (!isLeaf) {
        node.children ??= [];
        currentLevel = node.children;
      }
    }
  }

  return root;
}

export function estimateTotalLoc(tree: RepositoryTreeEntry[]): number {
  return tree
    .filter((entry) => entry.type === 'file')
    .reduce((total, entry) => total + (entry.size ?? 50), 0);
}

export function selectAnalysisStrategy(totalLocEstimate: number): 'on-demand' | 'indexed' {
  return totalLocEstimate < 10_000 ? 'on-demand' : 'indexed';
}
