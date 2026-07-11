import type { CodebaseContext, RepositoryTreeEntry } from '@autodev/shared-types';
import { detectArchitecturalLayers } from './architecturalLayerDetector.js';
import { buildDependencyGraph } from './dependencyGraphBuilder.js';
import { detectDesignPatterns } from './designPatternDetector.js';
import {
  buildFileStructureMap,
  estimateTotalLoc,
  selectAnalysisStrategy,
} from './fileStructureAnalyzer.js';
import { detectNamingConventions } from './namingConventionDetector.js';

export interface AnalyzeCodebaseInput {
  owner: string;
  repo: string;
  branch: string;
  tree: RepositoryTreeEntry[];
  fileContents: Record<string, string>;
  treeSha?: string;
}

export function analyzeCodebase(input: AnalyzeCodebaseInput): CodebaseContext {
  const totalLocEstimate = estimateTotalLoc(input.tree);
  const strategy = selectAnalysisStrategy(totalLocEstimate);

  return {
    owner: input.owner,
    repo: input.repo,
    branch: input.branch,
    treeSha: input.treeSha,
    totalLocEstimate,
    strategy,
    fileStructureMap: buildFileStructureMap(input.tree),
    namingConventions: detectNamingConventions(input.tree),
    designPatterns: detectDesignPatterns(input.tree),
    dependencyGraph: buildDependencyGraph(input.fileContents),
    architecturalLayers: detectArchitecturalLayers(input.tree),
    analyzedAt: new Date().toISOString(),
  };
}

export function computeTreeFingerprint(tree: RepositoryTreeEntry[]): string {
  return tree
    .filter((entry) => entry.type === 'file')
    .map((entry) => `${entry.path}:${entry.sha ?? entry.size ?? 0}`)
    .sort()
    .join('|');
}
