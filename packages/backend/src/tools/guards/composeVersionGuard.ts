import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const COMPOSE_FILE_PATTERN = /(^|\/)docker-compose[^/]*\.ya?ml$/i;
const VERSION_FIELD_PATTERN = /^\s*version\s*:/m;

export type ComposeVersionHit = {
  relativePath: string;
  message: string;
};

function walkComposeFiles(root: string, current: string, out: string[]): void {
  let entries: string[];
  try {
    entries = readdirSync(current);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === 'node_modules' || entry === '.git' || entry === 'dist') {
      continue;
    }
    const absolute = join(current, entry);
    let stats;
    try {
      stats = statSync(absolute);
    } catch {
      continue;
    }
    if (stats.isDirectory()) {
      walkComposeFiles(root, absolute, out);
      continue;
    }
    if (COMPOSE_FILE_PATTERN.test(absolute.replace(/\\/g, '/'))) {
      out.push(absolute);
    }
  }
}

/** Discover docker-compose*.yml files under a repo root. */
export function findComposeYamlFiles(repoRoot: string): string[] {
  const files: string[] = [];
  walkComposeFiles(repoRoot, repoRoot, files);
  return files;
}

/** Reject Compose files that still declare the deprecated top-level `version:` field (Compose V5). */
export function findDeprecatedComposeVersionFields(
  repoRoot: string,
  files?: string[],
  readFile: (absolutePath: string) => string = (path) => readFileSync(path, 'utf8'),
): ComposeVersionHit[] {
  const targets = files ?? findComposeYamlFiles(repoRoot);
  const hits: ComposeVersionHit[] = [];

  for (const absolutePath of targets) {
    const relativePath = relative(repoRoot, absolutePath).replace(/\\/g, '/');
    if (!COMPOSE_FILE_PATTERN.test(relativePath)) {
      continue;
    }

    let content: string;
    try {
      content = readFile(absolutePath);
    } catch {
      continue;
    }

    if (VERSION_FIELD_PATTERN.test(content)) {
      hits.push({
        relativePath,
        message: `${relativePath}: deprecated Compose \`version:\` field is not allowed (Compose V5 format).`,
      });
    }
  }

  return hits;
}

export function formatComposeVersionErrors(hits: ComposeVersionHit[]): string {
  return [
    'Docker Compose V5 files must not include a top-level `version:` field.',
    ...hits.map((hit) => ` - ${hit.message}`),
  ].join('\n');
}
