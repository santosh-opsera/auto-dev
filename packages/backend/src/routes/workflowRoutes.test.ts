import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
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
    login,
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

const HAPPY_PATH: Array<{ toState: string; trigger: string }> = [
  { toState: 'TICKET_PARSED', trigger: 'ticket.parsed' },
  { toState: 'ANALYZING', trigger: 'analysis.started' },
  { toState: 'ANALYSIS_COMPLETE', trigger: 'analysis.completed' },
  { toState: 'AWAITING_APPROVAL', trigger: 'approval.requested' },
  { toState: 'APPROVED', trigger: 'approval.cleared' },
  { toState: 'IMPLEMENTING', trigger: 'implementation.started' },
  { toState: 'TESTING', trigger: 'testing.started' },
  { toState: 'TEST_PASSED', trigger: 'testing.passed' },
  { toState: 'PR_CREATING', trigger: 'pr.creating' },
  { toState: 'PR_CREATED', trigger: 'pr.created' },
];

describe('workflow routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowModel(),
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

  it('requires session on workflow routes', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/workflows');
    expect(response.status).toBe(401);
  });

  it('runs full workflow lifecycle from CREATED to PR_CREATED', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const created = await request(app)
      .post('/api/v1/workflows')
      .set('Cookie', sessionCookie)
      .send({ ticketKey: 'OPL-9001', workflowId: 'wf-9001' });

    expect(created.status).toBe(201);
    expect(created.body.state).toBe('CREATED');
    expect(created.body.availableTransitions).toContain('TICKET_PARSED');

    let currentId = created.body.id as string;

    for (const step of HAPPY_PATH) {
      const transitioned = await request(app)
        .post(`/api/v1/workflows/${currentId}/transition`)
        .set('Cookie', sessionCookie)
        .send(step);

      expect(transitioned.status).toBe(200);
      expect(transitioned.body.state).toBe(step.toState);
      currentId = transitioned.body.id;
    }

    const detail = await request(app)
      .get(`/api/v1/workflows/${currentId}`)
      .set('Cookie', sessionCookie);

    expect(detail.status).toBe(200);
    expect(detail.body.state).toBe('PR_CREATED');
    expect(detail.body.history).toHaveLength(HAPPY_PATH.length);
    expect(detail.body.availableTransitions).toEqual([]);

    const listed = await request(app)
      .get('/api/v1/workflows')
      .query({ state: 'PR_CREATED' })
      .set('Cookie', sessionCookie);

    expect(listed.status).toBe(200);
    expect(listed.body.workflows).toHaveLength(1);
    expect(listed.body.workflows[0].workflowId).toBe('wf-9001');
  });

  it('supports pause/resume/cancel and fail/retry control endpoints', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const created = await request(app)
      .post('/api/v1/workflows')
      .set('Cookie', sessionCookie)
      .send({ ticketKey: 'OPL-9002', workflowId: 'wf-9002' });

    const id = created.body.id as string;

    for (const step of HAPPY_PATH.slice(0, 6)) {
      const transitioned = await request(app)
        .post(`/api/v1/workflows/${id}/transition`)
        .set('Cookie', sessionCookie)
        .send(step);
      expect(transitioned.status).toBe(200);
    }

    const paused = await request(app)
      .post(`/api/v1/workflows/${id}/pause`)
      .set('Cookie', sessionCookie)
      .send({ progress: { percent: 55, phase: 'chunking' } });

    expect(paused.status).toBe(200);
    expect(paused.body.state).toBe('PAUSED');
    expect(paused.body.pausedFrom).toBe('IMPLEMENTING');

    const resumed = await request(app)
      .post(`/api/v1/workflows/${id}/resume`)
      .set('Cookie', sessionCookie);

    expect(resumed.status).toBe(200);
    expect(resumed.body.state).toBe('IMPLEMENTING');

    const toTesting = await request(app)
      .post(`/api/v1/workflows/${id}/transition`)
      .set('Cookie', sessionCookie)
      .send({ toState: 'TESTING', trigger: 'testing.started' });
    expect(toTesting.status).toBe(200);

    const failed = await request(app)
      .post(`/api/v1/workflows/${id}/fail`)
      .set('Cookie', sessionCookie)
      .send({ error: { message: 'suite failed', code: 'TEST_FAILED' } });

    expect(failed.status).toBe(200);
    expect(failed.body.state).toBe('FAILED');
    expect(failed.body.error.failedFrom).toBe('TESTING');

    const retried = await request(app)
      .post(`/api/v1/workflows/${id}/retry`)
      .set('Cookie', sessionCookie);

    expect(retried.status).toBe(200);
    expect(retried.body.state).toBe('TESTING');

    const cancelled = await request(app)
      .post(`/api/v1/workflows/${id}/cancel`)
      .set('Cookie', sessionCookie);

    expect(cancelled.status).toBe(200);
    expect(cancelled.body.state).toBe('CANCELLED');

    const invalid = await request(app)
      .post(`/api/v1/workflows/${id}/transition`)
      .set('Cookie', sessionCookie)
      .send({ toState: 'IMPLEMENTING' });

    expect(invalid.status).toBe(409);
  });
});
