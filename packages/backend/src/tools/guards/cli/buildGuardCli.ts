#!/usr/bin/env npx tsx
/**
 * CLI entry for `npm run build` source-tree guard (WO-040).
 */

import { findMonorepoRoot, moduleDir } from '../repoRoot.js';
import { runBuildSourceGuard } from '../buildSourceGuard.js';

const root = process.env.AUTODEV_REPO_ROOT
  ? findMonorepoRoot(process.env.AUTODEV_REPO_ROOT)
  : findMonorepoRoot(moduleDir(import.meta.url));

const result = runBuildSourceGuard(root);

if (!result.ok) {
  console.error(result.message);
  console.error('');
  console.error(
    `Scanned source roots: ${result.scannedRoots.join(', ') || '(none found)'}`,
  );
  console.error('AutoDev build guard failed. Remove forbidden paths from source trees.');
  process.exit(1);
}

console.log(
  `AutoDev build guard passed (${result.scannedRoots.length} source root(s) scanned).`,
);
process.exit(0);
