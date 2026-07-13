import { describe, expect, it } from 'vitest';

import {
  BRANCH_GIT_STATUSES,
  canTransitionChunkStatus,
  chunkDecompositionDraftSchema,
  chunkDecomposeRequestSchema,
  chunkListResponseSchema,
  chunkStatusUpdateRequestSchema,
  implementationChunkResponseSchema,
  workflowChunkIdParamsSchema,
} from './chunk.js';
import {
  branchNamePreviewResponseSchema,
  chunkBranchResponseSchema,
  chunkCommitResponseSchema,
  commitChunkRequestSchema,
  commitMessagePreviewResponseSchema,
  createChunkBranchRequestSchema,
} from './branchCommit.js';
import {
  sampleBranchCommitConventions,
  sampleExpectedBranchName,
  sampleExpectedCommitMessage,
} from './fixtures/branchCommit.js';
import { sampleImplementationChunks } from './fixtures/chunk.js';

describe('branchCommit schemas', () => {
  it('accepts create-branch and commit payloads', () => {
    expect(createChunkBranchRequestSchema.safeParse({ type: 'feature' }).success).toBe(true);
    expect(
      commitChunkRequestSchema.safeParse({
        files: [{ path: 'src/a.ts', content: 'export {};\n' }],
      }).success,
    ).toBe(true);
    expect(chunkBranchResponseSchema.safeParse({
      chunk: {
        ...sampleImplementationChunks[0],
        status: 'IN_PROGRESS',
        branchName: sampleExpectedBranchName,
        gitStatus: 'branch_created',
      },
      branchName: sampleExpectedBranchName,
      baseBranch: 'main',
      headSha: 'abc',
      owner: 'o',
      repo: 'r',
      created: true,
    }).success).toBe(true);
    expect(chunkCommitResponseSchema.safeParse({
      chunk: {
        ...sampleImplementationChunks[0],
        status: 'COMPLETED',
        branchName: sampleExpectedBranchName,
        lastCommitSha: 'def',
        lastCommitMessage: sampleExpectedCommitMessage,
        gitStatus: 'ready_for_pr',
      },
      branchName: sampleExpectedBranchName,
      commitSha: 'def',
      commitMessage: sampleExpectedCommitMessage,
      owner: 'o',
      repo: 'r',
      filesCommitted: ['src/a.ts'],
      readyForPr: true,
    }).success).toBe(true);
  });

  it('exports git status enum and preview schemas', () => {
    expect(BRANCH_GIT_STATUSES).toContain('ready_for_pr');
    expect(
      branchNamePreviewResponseSchema.safeParse({
        branchName: sampleExpectedBranchName,
        branchNameTemplate: sampleBranchCommitConventions.branchNameTemplate,
        branchNamingPattern: sampleBranchCommitConventions.branchNamingPattern,
        valid: true,
        ticketKey: 'OPL-1234',
      }).success,
    ).toBe(true);
    expect(
      commitMessagePreviewResponseSchema.safeParse({
        commitMessage: sampleExpectedCommitMessage,
        commitMessageFormat: sampleBranchCommitConventions.commitMessageFormat,
        valid: true,
        ticketKey: 'OPL-1234',
      }).success,
    ).toBe(true);
  });

  it('keeps chunk schema and transition helpers intact', () => {
    expect(implementationChunkResponseSchema.safeParse(sampleImplementationChunks[0]).success).toBe(
      true,
    );
    expect(canTransitionChunkStatus('PENDING', 'IN_PROGRESS')).toBe(true);
    expect(chunkDecomposeRequestSchema.safeParse({ prdId: 'x' }).success).toBe(true);
    expect(chunkStatusUpdateRequestSchema.safeParse({ status: 'COMPLETED' }).success).toBe(true);
    expect(workflowChunkIdParamsSchema.safeParse({ id: 'w', chunkId: 'c' }).success).toBe(true);
    expect(chunkListResponseSchema.safeParse({ chunks: sampleImplementationChunks }).success).toBe(
      true,
    );
    expect(chunkDecompositionDraftSchema.safeParse({ chunks: [] }).success).toBe(false);
  });
});
