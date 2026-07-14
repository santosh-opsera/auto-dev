import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  mockGitHubPullRequestResponse,
  sampleApprovedPrd,
  samplePrCreationConventions,
  samplePrdSections,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { encryptSecret } from '../lib/encryption.js';
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
import { eventBus } from '../services/events/eventBus.js';
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

describe('pull request routes', () => {
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
    resetAuthRateLimits();
    await resetLockouts();
    eventBus.clearHistory();
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

  async function seedReady(userId: string) {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-route-pr-001',
      ticketKey: 'OPL-1234',
      state: 'TEST_PASSED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: 'OPL-1234',
      ticketIntentId: 'intent-route-pr',
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
      ...samplePrCreationConventions,
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

    await getImplementationChunkModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Add user auth',
      description: 'Implement authentication helpers',
      scope: {
        files: ['packages/backend/src/services/github/prCreationService.ts'],
        modules: ['backend/services/github'],
      },
      dependencies: [],
      estimatedComplexity: 'medium',
      status: 'COMPLETED',
      branchName: 'feature/OPL-1234-add-user-auth',
      gitStatus: 'ready_for_pr',
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

    return { workflow };
  }

  it('creates and fetches a pull request via workflow APIs', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow } = await seedReady(String(user!._id));

    vi.spyOn(githubApiClientModule.githubApiClient, 'createPullRequest').mockResolvedValue({
      number: mockGitHubPullRequestResponse.number,
      htmlUrl: mockGitHubPullRequestResponse.html_url,
      title: mockGitHubPullRequestResponse.title,
      body: mockGitHubPullRequestResponse.body,
      headBranch: mockGitHubPullRequestResponse.head.ref,
      baseBranch: mockGitHubPullRequestResponse.base.ref,
      state: mockGitHubPullRequestResponse.state,
    });
    vi.spyOn(githubApiClientModule.githubApiClient, 'requestPullRequestReviewers').mockResolvedValue(
      undefined,
    );
    vi.spyOn(githubApiClientModule.githubApiClient, 'addPullRequestLabels').mockResolvedValue(
      undefined,
    );

    const created = await request(app)
      .post(`/api/v1/workflows/${workflow._id.toString()}/pull-request`)
      .set('Cookie', sessionCookie)
      .send({ changeType: 'feature' });

    expect(created.status).toBe(201);
    expect(created.body.prUrl).toBe(mockGitHubPullRequestResponse.html_url);
    expect(created.body.labels).toEqual(['feature']);
    expect(created.body.reviewers).toEqual(['octocat', 'hubot']);
    expect(eventBus.getHistory().some((event) => event.type === 'PR_CREATED')).toBe(true);

    const fetched = await request(app)
      .get(`/api/v1/workflows/${workflow._id.toString()}/pull-request`)
      .set('Cookie', sessionCookie);

    expect(fetched.status).toBe(200);
    expect(fetched.body.prUrl).toBe(created.body.prUrl);
    expect(fetched.body.created).toBe(false);

    const detail = await request(app)
      .get(`/api/v1/workflows/${workflow._id.toString()}`)
      .set('Cookie', sessionCookie);

    expect(detail.status).toBe(200);
    expect(detail.body.state).toBe('PR_CREATED');
    expect(detail.body.prUrl).toBe(created.body.prUrl);
  });

  it('returns actionable validation errors for bad payloads', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow } = await seedReady(String(user!._id));

    const response = await request(app)
      .post(`/api/v1/workflows/${workflow._id.toString()}/pull-request`)
      .set('Cookie', sessionCookie)
      .send({ changeType: 'hotfix' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('ValidationError');
  });
});
