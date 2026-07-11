import type { DesignPattern, RepositoryTreeEntry } from '@autodev/shared-types';

export function detectDesignPatterns(tree: RepositoryTreeEntry[]): DesignPattern[] {
  const paths = tree.map((entry) => entry.path);
  const patterns: DesignPattern[] = [];

  const hasControllers = paths.some((path) => /controllers?\//i.test(path));
  const hasModels = paths.some((path) => /models?\//i.test(path));
  const hasRepositories = paths.some((path) => /repositories?\//i.test(path));
  const hasServices = paths.some((path) => /services?\//i.test(path));
  const hasFactories = paths.some((path) => /factories?\//i.test(path) || /Factory\./.test(path));
  const hasEvents = paths.some((path) => /events?\//i.test(path) || /eventBus/i.test(path));
  const hasSingleton = paths.some((path) => /singleton/i.test(path) || /getInstance/i.test(path));

  if (hasControllers && hasModels) {
    patterns.push({
      pattern: 'mvc',
      evidence: paths.filter((path) => /controllers?\//i.test(path) || /models?\//i.test(path)).slice(0, 4),
      confidence: 0.8,
    });
  }

  if (hasRepositories) {
    patterns.push({
      pattern: 'repository',
      evidence: paths.filter((path) => /repositories?\//i.test(path)).slice(0, 4),
      confidence: 0.9,
    });
  }

  if (hasServices) {
    patterns.push({
      pattern: 'service-layer',
      evidence: paths.filter((path) => /services?\//i.test(path)).slice(0, 4),
      confidence: 0.85,
    });
  }

  if (hasFactories) {
    patterns.push({
      pattern: 'factory',
      evidence: paths.filter((path) => /factories?\//i.test(path) || /Factory\./.test(path)).slice(0, 4),
      confidence: 0.7,
    });
  }

  if (hasSingleton) {
    patterns.push({
      pattern: 'singleton',
      evidence: paths.filter((path) => /singleton/i.test(path)).slice(0, 4),
      confidence: 0.65,
    });
  }

  if (hasEvents) {
    patterns.push({
      pattern: 'observer',
      evidence: paths.filter((path) => /events?\//i.test(path) || /eventBus/i.test(path)).slice(0, 4),
      confidence: 0.75,
    });
  }

  return patterns;
}
