import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
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
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { encryptSecret } from '@autodev/infrastructure';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getConventionSettingsModel } from '../models/conventionSettingsModel.js';
import { getImplementationChunkModel } from '../models/implementationChunkModel.js';
import { getPrdModel } from '../models/prdModel.js';
import { getRepositoryConnectionModel } from '../models/repositoryConnectionModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowModel } from '../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import * as githubApiClientModule from '../services/github/githubApiClient.js';

vi.mock('../services/auth/githubAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/githubAuthService.js')>();
  return {
    ...actual,
    exchangeGitHubCode: vi.fn(),
  };
});

import { exchangeGitHubCode } from '../services/auth/githubAuthService.js';

async function loginAsUser(app: ReturnType<typeof createApp>) {
  const login = await request(app)
    .post('/api/v1/auth/github/callback')
    .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

  const cookieHeader = login.headers['set-cookie'];
  const sessionCookie = Array.isArray(cookieHeader)
    ? cookieHeader.find((cookie) => cookie.startsWith('autodev_session='))
    : undefined;

  return {
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('branch and commit chunk routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
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
    await resetAuthRateLimits();
    await resetLockouts();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getConventionSettingsModel().deleteMany({});
    await getRepositoryConnectionModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);

    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: mockGitHubUserResponse.email ?? 'alex.dev@example.com',
      displayName: mockGitHubUserResponse.name ?? mockGitHubUserResponse.login,
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email', 'repo'],
    });
  });

  async function seedReadyChunk(userId: string) {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-route-branch-001',
      ticketKey: 'OPL-1234',
      state: 'IMPLEMENTING',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: 'OPL-1234',
      ticketIntentId: 'intent-route-1',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      createdBy: userId,
      updatedBy: userId,
    });

    await getConventionSettingsModel().create({
      userId,
      version: 1,
      isActive: true,
      ...sampleBranchCommitConventions,
      createdBy: userId,
      updatedBy: userId,
    });

    await getRepositoryConnectionModel().create({
      userId,
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      fullName: 'santosh-opsera/auto-dev',
      defaultBranch: 'main',
      connectedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    const chunk = await getImplementationChunkModel().create({
      userId,
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
      createdBy: userId,
      updatedBy: userId,
    });

    const user = await getUserModel().findById(userId).exec();
    user!.github = {
      providerUserId: '1',
      encryptedAccessToken: encryptSecret('gh-token'),
      scopes: ['repo', 'read:user', 'user:email'],
    };
    await user!.save();

    return { workflow, chunk };
  }

  it('previews, creates branch, commits, and writes audit logs', async () => {
    const getRef = vi
      .spyOn(githubApiClientModule.githubApiClient, 'getRef')
      .mockResolvedValue({ ref: 'refs/heads/main', sha: mockGitHubGitRefResponse.object.sha });
    const createRef = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createRef')
      .mockResolvedValue({
        ref: `refs/heads/${sampleExpectedBranchName}`,
        sha: mockGitHubGitRefResponse.object.sha,
      });
    const getCommit = vi
      .spyOn(githubApiClientModule.githubApiClient, 'getCommit')
      .mockResolvedValue({
        sha: mockGitHubGitCommitResponse.sha,
        treeSha: mockGitHubGitCommitResponse.tree.sha,
        message: mockGitHubGitCommitResponse.message,
        parentShas: [],
      });
    const createBlob = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createBlob')
      .mockResolvedValue({ sha: mockGitHubCreatedBlobResponse.sha });
    const createTree = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createTree')
      .mockResolvedValue({ sha: mockGitHubCreatedTreeResponse.sha });
    const createCommit = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createCommit')
      .mockResolvedValue({
        sha: mockGitHubCreatedCommitResponse.sha,
        treeSha: mockGitHubCreatedTreeResponse.sha,
        message: sampleExpectedCommitMessage,
        parentShas: [mockGitHubGitCommitResponse.sha],
      });
    const updateRef = vi
      .spyOn(githubApiClientModule.githubApiClient, 'updateRef')
      .mockResolvedValue({
        ref: `refs/heads/${sampleExpectedBranchName}`,
        sha: mockGitHubCreatedCommitResponse.sha,
      });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow, chunk } = await seedReadyChunk(String(user!._id));
    const base = `/api/v1/workflows/${workflow._id.toString()}/chunks/${chunk._id.toString()}`;

    const preview = await request(app)
      .get(`${base}/branch/preview`)
      .query({ type: 'feature', description: 'Add user auth' })
      .set('Cookie', sessionCookie);

    expect(preview.status).toBe(200);
    expect(preview.body.branchName).toBe(sampleExpectedBranchName);
    expect(preview.body.valid).toBe(true);

    const commitPreview = await request(app)
      .get(`${base}/commit/preview`)
      .query({ description: 'Add user auth' })
      .set('Cookie', sessionCookie);

    expect(commitPreview.status).toBe(200);
    expect(commitPreview.body.commitMessage).toBe(sampleExpectedCommitMessage);

    const branch = await request(app)
      .post(`${base}/branch`)
      .set('Cookie', sessionCookie)
      .send({ type: 'feature', description: 'Add user auth' });

    expect(branch.status).toBe(201);
    expect(branch.body.branchName).toBe(sampleExpectedBranchName);
    expect(branch.body.created).toBe(true);
    expect(getRef).toHaveBeenCalled();
    expect(createRef).toHaveBeenCalled();

    const commit = await request(app)
      .post(`${base}/commit`)
      .set('Cookie', sessionCookie)
      .send({
        files: [
          {
            path: 'packages/backend/src/services/git/branchCommitService.ts',
            content: 'export const branchCommitService = {};\n',
          },
        ],
      });

    expect(commit.status).toBe(201);
    expect(commit.body.commitSha).toBe('sha-commit-001');
    expect(commit.body.commitMessage).toBe(sampleExpectedCommitMessage);
    expect(commit.body.readyForPr).toBe(true);
    expect(createBlob).toHaveBeenCalled();
    expect(createTree).toHaveBeenCalled();
    expect(createCommit).toHaveBeenCalled();
    expect(updateRef).toHaveBeenCalled();

    const audits = await getAuditLogModel().find({}).exec();
    expect(audits.some((record) => record.resource.endsWith('/branch'))).toBe(true);
    expect(audits.some((record) => record.resource.endsWith('/commit'))).toBe(true);

    getRef.mockRestore();
    createRef.mockRestore();
    getCommit.mockRestore();
    createBlob.mockRestore();
    createTree.mockRestore();
    createCommit.mockRestore();
    updateRef.mockRestore();
  });

  it('rejects unauthenticated branch creation', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/workflows/wf/chunks/chunk/branch')
      .send({ type: 'feature' });

    expect(response.status).toBe(401);
  });
});
