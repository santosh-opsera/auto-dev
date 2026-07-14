import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleApprovedPrd,
  sampleBuggySourceFiles,
  sampleFixedSourceFiles,
  sampleGeneratedTestsLlmJson,
  samplePrdSections,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getChunkTestReportModel } from '../models/chunkTestReportModel.js';
import { getImplementationChunkModel } from '../models/implementationChunkModel.js';
import { getPrdModel } from '../models/prdModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowModel } from '../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { eventBus } from '@autodev/infrastructure';

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

describe('chunk test routes', () => {
  beforeAll(async () => {
    process.env.LLM_PRIMARY_PROVIDER = 'local';
    process.env.LLM_FAILOVER_ORDER = 'local';
    process.env.LLM_LOCAL_MOCK_RESPONSE = sampleGeneratedTestsLlmJson;
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getChunkTestReportModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    delete process.env.LLM_LOCAL_MOCK_RESPONSE;
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    process.env.LLM_LOCAL_MOCK_RESPONSE = sampleGeneratedTestsLlmJson;
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getChunkTestReportModel().deleteMany({});
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

  async function seedChunk(userId: string) {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-route-test-001',
      ticketKey: sampleApprovedPrd.ticketKey,
      state: 'TESTING',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: sampleApprovedPrd.ticketKey,
      ticketIntentId: 'intent-1',
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

    const chunk = await getImplementationChunkModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Fix add helper',
      description: 'Correct add implementation',
      scope: {
        files: ['src/math/add.ts'],
        modules: ['math'],
      },
      dependencies: [],
      estimatedComplexity: 'low',
      status: 'IN_PROGRESS',
      createdBy: userId,
      updatedBy: userId,
    });

    return { workflow, chunk };
  }

  it('POST /test passes with clean sources and GET /test-report returns the report', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow, chunk } = await seedChunk(String(user!._id));
    const base = `/api/v1/workflows/${workflow._id.toString()}/chunks/${chunk._id.toString()}`;

    const run = await request(app)
      .post(`${base}/test`)
      .set('Cookie', sessionCookie)
      .send({
        maxIterations: 3,
        sourceFiles: sampleFixedSourceFiles,
      });

    expect(run.status).toBe(200);
    expect(run.body.report.status).toBe('passed');
    expect(run.body.report.framework).toBe('vitest');
    expect(run.body.report.generatedTests.length).toBeGreaterThanOrEqual(3);
    expect(eventBus.getHistory().some((event) => event.type === 'TESTING_PASSED')).toBe(true);

    const report = await request(app).get(`${base}/test-report`).set('Cookie', sessionCookie);
    expect(report.status).toBe(200);
    expect(report.body.report.id).toBe(run.body.report.id);
  });

  it('rejects unbounded maxIterations and 404s missing reports', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow, chunk } = await seedChunk(String(user!._id));
    const base = `/api/v1/workflows/${workflow._id.toString()}/chunks/${chunk._id.toString()}`;

    const invalid = await request(app)
      .post(`${base}/test`)
      .set('Cookie', sessionCookie)
      .send({ maxIterations: 100 });

    expect(invalid.status).toBe(400);

    const missing = await request(app).get(`${base}/test-report`).set('Cookie', sessionCookie);
    expect(missing.status).toBe(404);
  });

  it('requires authentication for POST /test', async () => {
    const app = createApp();
    const user = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const { workflow, chunk } = await seedChunk(String(user!._id));
    const base = `/api/v1/workflows/${workflow._id.toString()}/chunks/${chunk._id.toString()}`;

    const unauthorized = await request(app)
      .post(`${base}/test`)
      .send({ sourceFiles: sampleBuggySourceFiles });
    expect(unauthorized.status).toBe(401);
  });
});
