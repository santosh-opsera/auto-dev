import type { ArchitecturalLayer, RepositoryTreeEntry } from '@autodev/shared-types';

const LAYER_RULES: Array<{ layer: string; pattern: RegExp }> = [
  { layer: 'controllers', pattern: /controllers?\//i },
  { layer: 'services', pattern: /services?\//i },
  { layer: 'repositories', pattern: /repositories?\//i },
  { layer: 'models', pattern: /models?\//i },
  { layer: 'routes', pattern: /routes?\//i },
  { layer: 'components', pattern: /components?\//i },
  { layer: 'pages', pattern: /pages?\//i },
];

export function detectArchitecturalLayers(tree: RepositoryTreeEntry[]): ArchitecturalLayer[] {
  const paths = tree.map((entry) => entry.path);

  return LAYER_RULES.flatMap(({ layer, pattern }) => {
    const matches = [...new Set(paths.filter((path) => pattern.test(path)).map((path) => path.split('/').slice(0, 2).join('/')))];
    if (matches.length === 0) {
      return [];
    }
    return [{ layer, paths: matches }];
  });
}
