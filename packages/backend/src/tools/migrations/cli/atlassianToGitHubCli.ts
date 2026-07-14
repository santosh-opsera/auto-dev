#!/usr/bin/env npx tsx
/**
 * CLI: migrate Atlassian-only users to require GitHub re-authentication (WO-007).
 *
 * Usage:
 *   npx tsx src/tools/migrations/cli/atlassianToGitHubCli.ts --dry-run
 *   npx tsx src/tools/migrations/cli/atlassianToGitHubCli.ts --execute
 *
 * Requires MONGODB_URI (or MONGO_URI) in the environment.
 */

import { connectMongo, disconnectMongo } from '../../../database/connection.js';
import { runAtlassianToGitHubMigration } from '../../../migrations/atlassianToGitHubMigration.js';

function parseMode(argv: string[]): 'dry-run' | 'execute' {
  if (argv.includes('--execute')) {
    return 'execute';
  }
  if (argv.includes('--dry-run') || argv.length === 0) {
    return 'dry-run';
  }
  console.error('Usage: atlassianToGitHubCli.ts [--dry-run | --execute]');
  process.exit(2);
}

async function main(): Promise<void> {
  const mode = parseMode(process.argv.slice(2));
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;

  if (!uri) {
    console.error('MONGODB_URI (or MONGO_URI) is required');
    process.exit(1);
  }

  await connectMongo(uri);
  try {
    const result = await runAtlassianToGitHubMigration(mode);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await disconnectMongo();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
