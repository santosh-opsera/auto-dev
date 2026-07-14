import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleApprovedPrd,
  sampleChunkLlmJsonResponse,
  samplePrdSections,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getImplementationChunkModel } from '../models/implementationChunkModel.js';
import { getPrdModel } from '../models/prdModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowModel } from '../models/workflowModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { eventBus } from '../services/events/eventBus.js';

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

describe('chunk routes', () => {
  beforeAll(async () => {
    process.env.LLM_PRIMARY_PROVIDER = 'local';
    process.env.LLM_FAILOVER_ORDER = 'local';
    process.env.LLM_LOCAL_MOCK_RESPONSE = sampleChunkLlmJsonResponse;
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    delete process.env.LLM_LOCAL_MOCK_RESPONSE;
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    process.env.LLM_LOCAL_MOCK_RESPONSE = sampleChunkLlmJsonResponse;
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
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

  async function seedWorkflowAndPrd(userId: string) {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-route-chunk-001',
      ticketKey: sampleApprovedPrd.ticketKey,
      state: 'APPROVED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: sampleApprovedPrd.ticketKey,
      ticketIntentId: sampleApprovedPrd.ticketIntentId,
      workflowId: workflow.workflowId,
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      approvedBy: 'Alex Developer',
      approvedAt: new Date('2026-07-13T12:00:00.000Z'),
      createdBy: userId,
      updatedBy: userId,
    });

    return { workflow, prd };
  }

  it('decomposes, lists, and updates chunk status end-to-end', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, prd } = await seedWorkflowAndPrd(String(user!._id));

    const decompose = await request(app)
      .post(`/api/v1/workflows/${workflow._id.toString()}/chunks/decompose`)
      .set('Cookie', sessionCookie)
      .send({ prdId: prd._id.toString() });

    expect(decompose.status).toBe(201);
    expect(decompose.body.chunks).toHaveLength(3);
    expect(decompose.body.chunks[0].name).toBeTruthy();
    expect(decompose.body.chunks[1].dependencies).toEqual([decompose.body.chunks[0].id]);

    const createdEvents = eventBus.getHistory().filter((event) => event.type === 'CHUNK_CREATED');
    expect(createdEvents).toHaveLength(3);

    const list = await request(app)
      .get(`/api/v1/workflows/${workflow._id.toString()}/chunks`)
      .set('Cookie', sessionCookie);

    expect(list.status).toBe(200);
    expect(list.body.chunks).toHaveLength(3);
    expect(list.body.chunks.map((chunk: { order: number }) => chunk.order)).toEqual([0, 1, 2]);

    const firstId = list.body.chunks[0].id as string;
    const secondId = list.body.chunks[1].id as string;

    const blocked = await request(app)
      .patch(`/api/v1/workflows/${workflow._id.toString()}/chunks/${secondId}/status`)
      .set('Cookie', sessionCookie)
      .send({ status: 'IN_PROGRESS' });
    expect(blocked.status).toBe(409);

    const startFirst = await request(app)
      .patch(`/api/v1/workflows/${workflow._id.toString()}/chunks/${firstId}/status`)
      .set('Cookie', sessionCookie)
      .send({ status: 'IN_PROGRESS' });
    expect(startFirst.status).toBe(200);
    expect(startFirst.body.status).toBe('IN_PROGRESS');

    const completeFirst = await request(app)
      .patch(`/api/v1/workflows/${workflow._id.toString()}/chunks/${firstId}/status`)
      .set('Cookie', sessionCookie)
      .send({ status: 'COMPLETED' });
    expect(completeFirst.status).toBe(200);

    const startSecond = await request(app)
      .patch(`/api/v1/workflows/${workflow._id.toString()}/chunks/${secondId}/status`)
      .set('Cookie', sessionCookie)
      .send({ status: 'IN_PROGRESS' });
    expect(startSecond.status).toBe(200);
    expect(startSecond.body.status).toBe('IN_PROGRESS');
  });

  it('requires authentication', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/workflows/wf-missing/chunks');
    expect(response.status).toBe(401);
  });
});
