import type { DependencyEdge } from '@autodev/shared-types';

const IMPORT_PATTERN = /import\s+(?:[\w*{}\s,]+\s+from\s+)?['"]([^'"]+)['"]/g;

export function buildDependencyGraph(fileContents: Record<string, string>): DependencyEdge[] {
  const edges: DependencyEdge[] = [];

  for (const [filePath, content] of Object.entries(fileContents)) {
    for (const match of content.matchAll(IMPORT_PATTERN)) {
      const target = match[1];
      if (!target || target.startsWith('.')) {
        edges.push({
          from: filePath,
          to: target.startsWith('.') ? resolveRelativeImport(filePath, target) : target,
          type: 'import',
        });
      }
    }
  }

  return edges;
}

function resolveRelativeImport(fromPath: string, importPath: string): string {
  const fromDir = fromPath.split('/').slice(0, -1);
  const segments = importPath.split('/');

  for (const segment of segments) {
    if (segment === '.') {
      continue;
    }
    if (segment === '..') {
      fromDir.pop();
      continue;
    }
    fromDir.push(segment);
  }

  return fromDir.join('/');
}
