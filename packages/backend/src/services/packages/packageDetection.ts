import {
  isPublishablePackageJson,
  type PackageJsonManifest,
  type PackageSnapshot,
} from '@autodev/shared-types';

export interface DetectedPackageRoot {
  packagePath: string;
  snapshot?: PackageSnapshot;
  publishable: boolean;
  reason?: string;
}

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

/**
 * Find the nearest package directory for a changed file given known package roots.
 * Roots are sorted longest-first so nested packages win.
 */
export function findPackageRootForFile(
  filePath: string,
  packageRoots: readonly string[],
): string | undefined {
  const normalized = normalizePath(filePath);
  const sorted = [...packageRoots].map(normalizePath).sort((a, b) => b.length - a.length);

  for (const root of sorted) {
    if (root === '.' || root === '') {
      return root === '' ? '.' : root;
    }
    if (normalized === root || normalized.startsWith(`${root}/`)) {
      return root;
    }
  }

  // Heuristic: walk parents looking for .../package.json path pattern in changed files set
  const parts = normalized.split('/');
  if (parts.length >= 2 && parts[0] === 'packages') {
    return `${parts[0]}/${parts[1]}`;
  }

  return undefined;
}

export function inferPackageRootsFromChangedFiles(changedFiles: readonly string[]): string[] {
  const roots = new Set<string>();

  for (const file of changedFiles) {
    const normalized = normalizePath(file);
    if (normalized.endsWith('/package.json') || normalized === 'package.json') {
      const dir = normalized === 'package.json' ? '.' : normalized.slice(0, -'/package.json'.length);
      roots.add(dir || '.');
      continue;
    }

    const parts = normalized.split('/');
    if (parts.length >= 2 && parts[0] === 'packages') {
      roots.add(`${parts[0]}/${parts[1]}`);
    }
  }

  return [...roots];
}

export function evaluatePublishability(manifest: PackageJsonManifest): {
  publishable: boolean;
  reason?: string;
} {
  if (manifest.private === true) {
    return { publishable: false, reason: 'Package is marked private' };
  }
  if (!isPublishablePackageJson(manifest)) {
    return {
      publishable: false,
      reason: "package.json lacks 'main' or 'exports' (not a publishable library)",
    };
  }
  return { publishable: true };
}

/**
 * Detect which publishable packages are affected by changed files.
 */
export function detectAffectedPackages(
  changedFiles: readonly string[],
  snapshots: readonly PackageSnapshot[],
): DetectedPackageRoot[] {
  const snapshotByPath = new Map(
    snapshots.map((s) => [normalizePath(s.packagePath), s] as const),
  );
  const rootsFromSnapshots = [...snapshotByPath.keys()];
  const rootsFromFiles = inferPackageRootsFromChangedFiles(changedFiles);
  const allRoots = new Set([...rootsFromSnapshots, ...rootsFromFiles]);

  const affected = new Set<string>();
  for (const file of changedFiles) {
    const root = findPackageRootForFile(file, [...allRoots]);
    if (root) {
      affected.add(normalizePath(root));
    }
  }

  const results: DetectedPackageRoot[] = [];

  for (const packagePath of affected) {
    const snapshot = snapshotByPath.get(packagePath);
    if (!snapshot) {
      results.push({
        packagePath,
        publishable: false,
        reason: 'No package snapshot provided for affected path',
      });
      continue;
    }

    const { publishable, reason } = evaluatePublishability(snapshot.packageJson);
    results.push({
      packagePath,
      snapshot,
      publishable,
      reason,
    });
  }

  return results;
}
