#!/usr/bin/env npx tsx
/**
 * CLI entry for husky pre-commit (WO-040).
 */

import { findMonorepoRoot, moduleDir } from '../repoRoot.js';
import { getStagedPaths, runPreCommitGuard } from '../preCommitGuard.js';

const root = process.env.AUTODEV_REPO_ROOT
  ? findMonorepoRoot(process.env.AUTODEV_REPO_ROOT)
  : findMonorepoRoot(moduleDir(import.meta.url));

const staged = process.argv.slice(2).length > 0 ? process.argv.slice(2) : getStagedPaths(root);

if (staged.length === 0) {
  console.log(
    'AutoDev pre-commit guard: no staged files — skipping path/SAST checks (audit still runs).',
  );
}

const result = runPreCommitGuard({
  repoRoot: root,
  stagedPaths: staged,
  skipSemgrep: process.env.AUTODEV_SKIP_SEMGREP === '1',
});

if (!result.ok) {
  for (const message of result.messages) {
    console.error(message);
    console.error('');
  }
  console.error('AutoDev pre-commit guard failed. Resolve the issues above and try again.');
  process.exit(1);
}

console.log('AutoDev pre-commit guard passed.');
process.exit(0);
