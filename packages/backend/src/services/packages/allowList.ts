import type { AllowListValidation } from '@autodev/shared-types';
import { createSafeRegExp } from '../../lib/safeRegExp.js';

function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/^\.\//, '');
}

function stripPackagePrefix(filePath: string, packagePath: string): string {
  const normalized = normalizePath(filePath);
  const root = normalizePath(packagePath);
  if (root === '.' || root === '') {
    return normalized;
  }
  if (normalized === root) {
    return '';
  }
  if (normalized.startsWith(`${root}/`)) {
    return normalized.slice(root.length + 1);
  }
  return normalized;
}

/**
 * Convert npm `files` field / .npmignore patterns into matchers.
 * Supports *, **, and trailing / directory prefixes (simplified).
 */
export function patternMatches(relativePath: string, pattern: string): boolean {
  const path = normalizePath(relativePath);
  const pat = normalizePath(pattern).replace(/\/$/, '');

  if (pat === '**' || pat === '*') {
    return true;
  }

  // Exact match
  if (path === pat) {
    return true;
  }

  // Directory prefix: "dist" matches "dist/..." 
  if (path.startsWith(`${pat}/`)) {
    return true;
  }

  // Glob: ** and *
  const escaped = pat
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::GLOBSTAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::GLOBSTAR::/g, '.*');

  try {
    const regex = createSafeRegExp(`^${escaped}$`);
    if (regex.test(path)) {
      return true;
    }
  } catch {
    return false;
  }

  // Allow "lib/**/*.js" style to match nested paths via globstar already handled
  return false;
}

export function parseNpmignore(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
}

/**
 * Validate which files would be included in the published tarball.
 * Prefer package.json `files` allow-list; else invert .npmignore; else default excludes.
 */
export function validateAllowList(input: {
  packagePath: string;
  filesField?: string[];
  npmignore?: string;
  packageFiles: readonly string[];
}): AllowListValidation {
  const relativeFiles = input.packageFiles.map((f) => ({
    absolute: normalizePath(f),
    relative: stripPackagePrefix(f, input.packagePath),
  }));

  if (input.filesField && input.filesField.length > 0) {
    const patterns = input.filesField.map(normalizePath);
    const included: string[] = [];
    const excluded: string[] = [];

    for (const file of relativeFiles) {
      if (!file.relative) {
        excluded.push(file.absolute);
        continue;
      }
      const allowed = patterns.some((p) => patternMatches(file.relative, p));
      if (allowed) {
        included.push(file.absolute);
      } else {
        excluded.push(file.absolute);
      }
    }

    return {
      allowedPatterns: patterns,
      includedFiles: included,
      excludedFiles: excluded,
      source: 'files',
    };
  }

  if (input.npmignore && input.npmignore.trim().length > 0) {
    const ignorePatterns = parseNpmignore(input.npmignore);
    const included: string[] = [];
    const excluded: string[] = [];

    for (const file of relativeFiles) {
      if (!file.relative) {
        excluded.push(file.absolute);
        continue;
      }
      const ignored = ignorePatterns.some((p) => patternMatches(file.relative, p));
      if (ignored) {
        excluded.push(file.absolute);
      } else {
        included.push(file.absolute);
      }
    }

    return {
      allowedPatterns: ignorePatterns.map((p) => `!${p}`),
      includedFiles: included,
      excludedFiles: excluded,
      source: 'npmignore',
    };
  }

  // Default npm publish exclusions (simplified allow everything except common sensitive paths)
  const defaultIgnore = ['.env', '*.pem', 'secrets', 'coverage', 'node_modules', '.git'];
  const included: string[] = [];
  const excluded: string[] = [];

  for (const file of relativeFiles) {
    if (!file.relative) {
      excluded.push(file.absolute);
      continue;
    }
    const ignored = defaultIgnore.some((p) => patternMatches(file.relative, p));
    if (ignored) {
      excluded.push(file.absolute);
    } else {
      included.push(file.absolute);
    }
  }

  return {
    allowedPatterns: defaultIgnore.map((p) => `!${p}`),
    includedFiles: included,
    excludedFiles: excluded,
    source: 'default',
  };
}
