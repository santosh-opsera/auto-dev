import {
  DEPENDENCY_FIELDS,
  type ConsumerPackageJson,
  type DependencyConsumer,
  type DependencyField,
  type DependencyGraph,
  type RepositoryDependencySnapshot,
} from '@autodev/shared-types';

function extractConsumersFromManifest(
  owner: string,
  repo: string,
  packagePath: string,
  packageJson: ConsumerPackageJson,
): DependencyConsumer[] {
  const consumers: DependencyConsumer[] = [];

  for (const field of DEPENDENCY_FIELDS) {
    const deps = packageJson[field];
    if (!deps || typeof deps !== 'object') {
      continue;
    }

    for (const [packageName, currentVersion] of Object.entries(deps)) {
      if (!packageName || typeof currentVersion !== 'string' || currentVersion.length === 0) {
        continue;
      }
      consumers.push({
        owner,
        repo,
        packagePath,
        dependencyField: field as DependencyField,
        packageName,
        currentVersion,
      });
    }
  }

  return consumers;
}

/**
 * Build a package → consumers dependency graph from repository package.json snapshots.
 * A package's consumers are other package.json files that list it as a dependency.
 */
export function buildDependencyGraph(
  repositories: readonly RepositoryDependencySnapshot[],
): DependencyGraph {
  const byPackage = new Map<string, DependencyConsumer[]>();
  let scannedPackageJsonFiles = 0;

  for (const repoSnap of repositories) {
    for (const file of repoSnap.packageJsonFiles) {
      scannedPackageJsonFiles += 1;
      const edges = extractConsumersFromManifest(
        repoSnap.owner,
        repoSnap.repo,
        file.path,
        file.packageJson,
      );

      for (const edge of edges) {
        const list = byPackage.get(edge.packageName) ?? [];
        list.push(edge);
        byPackage.set(edge.packageName, list);
      }
    }
  }

  const packages = [...byPackage.entries()]
    .map(([packageName, consumers]) => ({
      packageName,
      consumers: [...consumers].sort((a, b) => {
        const keyA = `${a.owner}/${a.repo}:${a.packagePath}:${a.dependencyField}`;
        const keyB = `${b.owner}/${b.repo}:${b.packagePath}:${b.dependencyField}`;
        return keyA.localeCompare(keyB);
      }),
    }))
    .sort((a, b) => a.packageName.localeCompare(b.packageName));

  const edgeCount = packages.reduce((sum, node) => sum + node.consumers.length, 0);

  return {
    packages,
    scannedRepositories: repositories.length,
    scannedPackageJsonFiles,
    edgeCount,
  };
}

/** Identify consumers of a specific package from a built graph. */
export function findConsumers(
  graph: DependencyGraph,
  packageName: string,
): DependencyConsumer[] {
  const node = graph.packages.find((p) => p.packageName === packageName);
  return node ? [...node.consumers] : [];
}
