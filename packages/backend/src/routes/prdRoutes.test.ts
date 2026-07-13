import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleAutoDevLikeContext,
  sampleCriticalGaps,
  samplePrdLlmJsonResponse,
  samplePrdSections,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getApprovalRequestModel } from '../models/approvalRequestModel.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getCodebaseContextModel } from '../models/codebaseContextModel.js';
import { getPrdModel } from '../models/prdModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';

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

describe('prd routes', () => {
  beforeAll(async () => {
    process.env.LLM_PRIMARY_PROVIDER = 'local';
    process.env.LLM_FAILOVER_ORDER = 'local';
    process.env.LLM_LOCAL_MOCK_RESPONSE = samplePrdLlmJsonResponse;
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getTicketIntentModel(),
      getCodebaseContextModel(),
      getApprovalRequestModel(),
      getPrdModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    delete process.env.LLM_LOCAL_MOCK_RESPONSE;
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    resetLockouts();
    process.env.LLM_LOCAL_MOCK_RESPONSE = samplePrdLlmJsonResponse;
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
    await getApprovalRequestModel().deleteMany({});
    await getPrdModel().deleteMany({});
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

  async function seedTicketData(userId: string, ticketKey: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey,
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach: sampleTicketIntent.proposedApproach,
      acceptanceCriteria: sampleTicketIntent.acceptanceCriteria,
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: sampleCriticalGaps,
      canProceedToAnalysis: false,
      createdBy: userId,
      updatedBy: userId,
    });

    await getCodebaseContextModel().create({
      userId,
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
      branch: sampleAutoDevLikeContext.branch,
      treeFingerprint: 'fp-prd-route',
      context: {
        ...sampleAutoDevLikeContext,
        analyzedAt: sampleAutoDevLikeContext.analyzedAt,
      },
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: userId,
      updatedBy: userId,
    });

    const approval = await getApprovalRequestModel().create({
      userId,
      ticketKey,
      workflowId: 'workflow-prd',
      ticketIntentId: intent._id.toString(),
      status: 'cleared',
      items: [],
      expiresAt: new Date(Date.now() + 72 * 60 * 60 * 1000),
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'confidential',
    });

    return { intent, approval };
  }

  it('runs full PRD generation flow with local LLM stub', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { intent, approval } = await seedTicketData(String(user!._id), 'OPL-8001');

    const started = Date.now();
    const generated = await request(app)
      .post('/api/v1/tickets/OPL-8001/prd/generate')
      .set('Cookie', sessionCookie)
      .send({
        workflowId: 'workflow-prd',
        approvalRequestId: approval._id.toString(),
        owner: sampleAutoDevLikeContext.owner,
        repo: sampleAutoDevLikeContext.repo,
      });
    const elapsedMs = Date.now() - started;

    expect(generated.status).toBe(201);
    expect(elapsedMs).toBeLessThan(30_000);
    expect(generated.body.ticketIntentId).toBe(intent._id.toString());
    expect(generated.body.approvalRequestId).toBe(approval._id.toString());
    expect(generated.body.version).toBe(1);
    expect(generated.body.sections.problemStatement).toBeTruthy();
    expect(generated.body.codebaseContext.affectedModules).toEqual(
      expect.arrayContaining(['backend', 'auth']),
    );

    const latest = await request(app)
      .get('/api/v1/tickets/OPL-8001/prd')
      .set('Cookie', sessionCookie);

    expect(latest.status).toBe(200);
    expect(latest.body.id).toBe(generated.body.id);

    const byId = await request(app)
      .get(`/api/v1/prd/${generated.body.id}`)
      .set('Cookie', sessionCookie);

    expect(byId.status).toBe(200);
    expect(byId.body.ticketKey).toBe('OPL-8001');

    const versioned = await request(app)
      .post(`/api/v1/prd/${generated.body.id}/versions`)
      .set('Cookie', sessionCookie)
      .send({
        sections: {
          ...samplePrdSections,
          solutionOutline: 'Updated after PO review',
        },
        status: 'in_review',
      });

    expect(versioned.status).toBe(201);
    expect(versioned.body.version).toBe(2);
    expect(versioned.body.previousVersionId).toBe(generated.body.id);

    const history = await request(app)
      .get('/api/v1/tickets/OPL-8001/prd?latest=false')
      .set('Cookie', sessionCookie);

    expect(history.status).toBe(200);
    expect(history.body.prds).toHaveLength(2);
  });

  it('returns 412 when ticket intent is missing', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/tickets/OPL-9999/prd/generate')
      .set('Cookie', sessionCookie)
      .send({
        owner: sampleAutoDevLikeContext.owner,
        repo: sampleAutoDevLikeContext.repo,
      });

    expect(response.status).toBe(412);
    expect(response.body.error).toBe('TicketIntentNotFound');
    expect(response.body.suggestedAction).toMatch(/Parse the ticket/i);
  });
});
