import type { ConventionSettingsInput } from '../conventions.js';
import type {
  BranchNamePreviewResponse,
  ChunkBranchResponse,
  ChunkCommitResponse,
  CommitMessagePreviewResponse,
  CreateChunkBranchRequest,
  CommitChunkRequest,
} from '../branchCommit.js';
import { sampleImplementationChunks } from './chunk.js';

/**
 * Sample conventions where generation template + validation regex align.
 * Patterns are NEVER hardcoded in services — always loaded from configuration.
 */
export const sampleBranchCommitConventions: ConventionSettingsInput = {
  commitMessageFormat: '{ticketKey}: {description}',
  branchNameTemplate: '{type}/{ticketKey}-{description}',
  branchNamingPattern: '^(feature|bugfix)/[A-Z]+-\\d+-[a-z0-9-]+$',
  prTitleTemplate: '{ticketKey} {summary}',
  prDescriptionTemplate: 'Context\n{context}\n\nChanges\n{changes}\n\nTicket\n{ticketKey}',
  reviewerAssignmentRules: {
    mode: 'manual-list',
    reviewers: ['octocat'],
  },
};

export const sampleCreateBranchRequest: CreateChunkBranchRequest = {
  type: 'feature',
  description: 'Add user auth',
};

export const sampleCommitChunkRequest: CommitChunkRequest = {
  files: [
    {
      path: 'packages/backend/src/services/git/branchCommitService.ts',
      content: 'export const branchCommitService = {};\n',
      encoding: 'utf-8',
    },
  ],
};

export const sampleExpectedBranchName = 'feature/OPL-1234-add-user-auth';
export const sampleExpectedCommitMessage = 'OPL-1234: Add user auth';

export const sampleBranchNamePreview: BranchNamePreviewResponse = {
  branchName: sampleExpectedBranchName,
  branchNameTemplate: sampleBranchCommitConventions.branchNameTemplate!,
  branchNamingPattern: sampleBranchCommitConventions.branchNamingPattern,
  valid: true,
  ticketKey: 'OPL-1234',
};

export const sampleCommitMessagePreview: CommitMessagePreviewResponse = {
  commitMessage: sampleExpectedCommitMessage,
  commitMessageFormat: sampleBranchCommitConventions.commitMessageFormat,
  valid: true,
  ticketKey: 'OPL-1234',
};

export const sampleChunkBranchResponse: ChunkBranchResponse = {
  chunk: {
    ...sampleImplementationChunks[0]!,
    status: 'IN_PROGRESS',
    branchName: sampleExpectedBranchName,
    branchHeadSha: 'sha-base-main',
    gitStatus: 'branch_created',
  },
  branchName: sampleExpectedBranchName,
  baseBranch: 'main',
  headSha: 'sha-base-main',
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  created: true,
};

export const sampleChunkCommitResponse: ChunkCommitResponse = {
  chunk: {
    ...sampleImplementationChunks[0]!,
    status: 'COMPLETED',
    branchName: sampleExpectedBranchName,
    branchHeadSha: 'sha-commit-001',
    lastCommitSha: 'sha-commit-001',
    lastCommitMessage: sampleExpectedCommitMessage,
    gitStatus: 'ready_for_pr',
  },
  branchName: sampleExpectedBranchName,
  commitSha: 'sha-commit-001',
  commitMessage: sampleExpectedCommitMessage,
  owner: 'santosh-opsera',
  repo: 'auto-dev',
  filesCommitted: [sampleCommitChunkRequest.files![0]!.path],
  readyForPr: true,
};

export const mockGitHubGitRefResponse = {
  ref: 'refs/heads/main',
  node_id: 'REF_main',
  url: 'https://api.github.com/repos/santosh-opsera/auto-dev/git/refs/heads/main',
  object: {
    type: 'commit',
    sha: 'sha-base-main',
    url: 'https://api.github.com/repos/santosh-opsera/auto-dev/git/commits/sha-base-main',
  },
};

export const mockGitHubGitCommitResponse = {
  sha: 'sha-base-main',
  tree: { sha: 'sha-tree-main' },
  parents: [],
  message: 'base',
};

export const mockGitHubCreatedBlobResponse = {
  sha: 'sha-blob-001',
  url: 'https://api.github.com/repos/santosh-opsera/auto-dev/git/blobs/sha-blob-001',
};

export const mockGitHubCreatedTreeResponse = {
  sha: 'sha-tree-001',
  url: 'https://api.github.com/repos/santosh-opsera/auto-dev/git/trees/sha-tree-001',
  tree: [],
};

export const mockGitHubCreatedCommitResponse = {
  sha: 'sha-commit-001',
  tree: { sha: 'sha-tree-001' },
  parents: [{ sha: 'sha-base-main' }],
  message: sampleExpectedCommitMessage,
};
