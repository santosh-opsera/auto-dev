import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockGitHubCreatedBlobResponse,
  mockGitHubCreatedCommitResponse,
  mockGitHubCreatedTreeResponse,
  mockGitHubGitCommitResponse,
  mockGitHubGitRefResponse,
  sampleApprovedPrd,
  sampleBranchCommitConventions,
  sampleExpectedBranchName,
  sampleExpectedCommitMessage,
  samplePrdSections,
} from '@autodev/shared-types';
import { encryptSecret } from '../../lib/encryption.js';
import {
  getImplementationChunkModel,
  type ImplementationChunkRecord,
} from '../../models/implementationChunkModel.js';
import { getConventionSettingsModel } from '../../models/conventionSettingsModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getRepositoryConnectionModel } from '../../models/repositoryConnectionModel.js';
import { getUserModel, type UserRecord } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { ensureIndexes } from '../../database/indexes.js';
import { GitHubApiClient } from '../github/githubApiClient.js';
import { BranchCommitService } from './branchCommitService.js';

describe('BranchCommitService', () => {
  let user: UserRecord;
  let service: BranchCommitService;
  let fetchImpl: ReturnType<typeof vi.fn>;

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getConventionSettingsModel(),
      getRepositoryConnectionModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getConventionSettingsModel().deleteMany({});
    await getRepositoryConnectionModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);

    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    loaded!.github = {
      providerUserId: '1',
      encryptedAccessToken: encryptSecret('gh-token'),
      scopes: ['repo', 'read:user', 'user:email'],
    };
    await loaded!.save();
    user = loaded!;

    fetchImpl = vi.fn();
    service = new BranchCommitService(new GitHubApiClient(fetchImpl));
  });

  function githubOk(body: unknown, status = 200) {
    return {
      status,
      headers: new Headers({
        'x-ratelimit-limit': '5000',
        'x-ratelimit-remaining': '4999',
        'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 3600),
      }),
      json: async () => body,
    };
  }
  async function seedChunk(): Promise<{
    workflowId: string;
    chunk: ImplementationChunkRecord;
  }> {
    const workflow = await getWorkflowModel().create({
      userId: String(user._id),
      workflowId: 'wf-branch-commit-001',
      ticketKey: 'OPL-1234',
      state: 'IMPLEMENTING',
      history: [],
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    const prd = await getPrdModel().create({
      userId: String(user._id),
      ticketKey: 'OPL-1234',
      ticketIntentId: 'intent-1',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    await getConventionSettingsModel().create({
      userId: String(user._id),
      version: 1,
      isActive: true,
      ...sampleBranchCommitConventions,
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    await getRepositoryConnectionModel().create({
      userId: String(user._id),
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      fullName: 'santosh-opsera/auto-dev',
      defaultBranch: 'main',
      connectedAt: new Date(),
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    const chunk = await getImplementationChunkModel().create({
      userId: String(user._id),
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Add user auth',
      description: 'Implement authentication helpers',
      scope: {
        files: ['packages/backend/src/services/git/branchCommitService.ts'],
        modules: ['backend/services/git'],
      },
      dependencies: [],
      estimatedComplexity: 'medium',
      status: 'PENDING',
      createdBy: String(user._id),
      updatedBy: String(user._id),
    });

    return { workflowId: workflow._id.toString(), chunk };
  }

  it('creates a remote branch from the default branch using conventions', async () => {
    const { workflowId, chunk } = await seedChunk();

    fetchImpl
      .mockResolvedValueOnce(githubOk(mockGitHubGitRefResponse))
      .mockResolvedValueOnce(
        githubOk(
          {
            ...mockGitHubGitRefResponse,
            ref: `refs/heads/${sampleExpectedBranchName}`,
            object: { ...mockGitHubGitRefResponse.object, sha: 'sha-base-main' },
          },
          201,
        ),
      );
    const result = await service.createBranch(user, workflowId, chunk._id.toString(), {
      type: 'feature',
      description: 'Add user auth',
    });

    expect(result.created).toBe(true);
    expect(result.branchName).toBe(sampleExpectedBranchName);
    expect(result.baseBranch).toBe('main');
    expect(result.chunk.status).toBe('IN_PROGRESS');
    expect(result.chunk.gitStatus).toBe('branch_created');
    expect(fetchImpl.mock.calls[0]?.[0]).toContain('/git/ref/heads/main');
    expect(fetchImpl.mock.calls[1]?.[0]).toContain('/git/refs');
    expect(JSON.parse(String(fetchImpl.mock.calls[1]?.[1]?.body))).toEqual({
      ref: `refs/heads/${sampleExpectedBranchName}`,
      sha: 'sha-base-main',
    });
  });

  it('rejects invalid branch names before calling GitHub', async () => {
    const { workflowId, chunk } = await seedChunk();

    await expect(
      service.createBranch(user, workflowId, chunk._id.toString(), {
        type: 'hotfix',
        description: 'Add user auth',
      }),
    ).rejects.toMatchObject({ error: 'InvalidBranchName', statusCode: 400 });

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('commits chunk files to the chunk branch with a convention message', async () => {
    const { workflowId, chunk } = await seedChunk();
    chunk.branchName = sampleExpectedBranchName;
    chunk.branchHeadSha = 'sha-base-main';
    chunk.gitStatus = 'branch_created';
    chunk.status = 'IN_PROGRESS';
    await chunk.save();

    fetchImpl
      .mockResolvedValueOnce(githubOk(mockGitHubGitCommitResponse))
      .mockResolvedValueOnce(githubOk(mockGitHubCreatedBlobResponse, 201))
      .mockResolvedValueOnce(githubOk(mockGitHubCreatedTreeResponse, 201))
      .mockResolvedValueOnce(githubOk(mockGitHubCreatedCommitResponse, 201))
      .mockResolvedValueOnce(
        githubOk({
          ref: `refs/heads/${sampleExpectedBranchName}`,
          object: { sha: 'sha-commit-001', type: 'commit' },
        }),
      );
    const result = await service.commitChanges(user, workflowId, chunk._id.toString(), {
      files: [
        {
          path: 'packages/backend/src/services/git/branchCommitService.ts',
          content: 'export const branchCommitService = {};\n',
        },
      ],
    });

    expect(result.commitSha).toBe('sha-commit-001');
    expect(result.commitMessage).toBe(sampleExpectedCommitMessage);
    expect(result.chunk.status).toBe('COMPLETED');
    expect(result.readyForPr).toBe(true);
    expect(result.chunk.gitStatus).toBe('ready_for_pr');
  });

  it('rejects commits without a branch and out-of-scope files', async () => {
    const { workflowId, chunk } = await seedChunk();

    await expect(
      service.commitChanges(user, workflowId, chunk._id.toString(), {
        files: [{ path: 'README.md', content: 'x' }],
      }),
    ).rejects.toMatchObject({ error: 'BranchRequired' });

    chunk.branchName = sampleExpectedBranchName;
    chunk.branchHeadSha = 'sha-base-main';
    chunk.gitStatus = 'branch_created';
    await chunk.save();

    await expect(
      service.commitChanges(user, workflowId, chunk._id.toString(), {
        files: [{ path: 'README.md', content: 'x' }],
      }),
    ).rejects.toMatchObject({ error: 'CommitOutOfScope' });
  });
});
