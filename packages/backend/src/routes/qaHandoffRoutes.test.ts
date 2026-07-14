import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleQaHandoffGenerateRequest,
  sampleQaHandoffRequestChanges,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getQaHandoffModel } from '../models/qaHandoffModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
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

describe('qa handoff routes', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowModel(),
      getTicketIntentModel(),
      getQaHandoffModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getQaHandoffModel().deleteMany({});
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

  async function seedWorkflowForUser() {
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' });
    if (!user) {
      throw new Error('seed user missing');
    }

    const workflow = await getWorkflowModel().create({
      userId: user._id.toString(),
      workflowId: 'workflow-001',
      ticketKey: sampleTicketIntent.ticketKey,
      state: 'PR_CREATED',
      history: [],
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
      dataClassification: 'internal',
    });

    await getTicketIntentModel().create({
      userId: user._id.toString(),
      ticketKey: sampleTicketIntent.ticketKey,
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach: sampleTicketIntent.proposedApproach,
      acceptanceCriteria: [
        ...sampleTicketIntent.acceptanceCriteria,
        'Refresh tokens rotate on use',
      ],
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: [],
      canProceedToAnalysis: true,
      createdBy: user._id.toString(),
      updatedBy: user._id.toString(),
      dataClassification: 'internal',
    });

    return workflow;
  }

  it('generates, retrieves, request-changes, and approves handoff end-to-end', async () => {
    const { sessionCookie } = await loginAsUser(app);
    const workflow = await seedWorkflowForUser();
    const base = `/api/v1/workflows/${workflow._id.toString()}/qa-handoff`;

    const create = await request(app)
      .post(base)
      .set('Cookie', sessionCookie)
      .send(sampleQaHandoffGenerateRequest);

    expect(create.status).toBe(201);
    expect(create.body.status).toBe('READY');
    expect(create.body.changeSummary.filesChanged.length).toBeGreaterThan(0);
    expect(create.body.jiraTicket.ticketKey).toBe('OPL-1234');
    expect(create.body.coverageReport.coveragePercent).toBeGreaterThan(0);
    expect(create.body.verificationChecklist.every((i: { status: string }) => i.status === 'unchecked')).toBe(
      true,
    );
    expect(create.body.deploymentUrl).toBeTruthy();

    const get = await request(app).get(base).set('Cookie', sessionCookie);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(create.body.id);

    const changes = await request(app)
      .post(`${base}/request-changes`)
      .set('Cookie', sessionCookie)
      .send(sampleQaHandoffRequestChanges);

    expect(changes.status).toBe(200);
    expect(changes.body.status).toBe('CHANGES_REQUESTED');
    expect(changes.body.feedbackItems).toHaveLength(2);

    const eventTypes = eventBus.getHistory().map((e) => e.type);
    expect(eventTypes).toContain('QA_HANDOFF_READY');
    expect(eventTypes).toContain('QA_CHANGES_REQUESTED');

    // Regenerate after changes so approve path is available
    const regen = await request(app)
      .post(base)
      .set('Cookie', sessionCookie)
      .send({ ...sampleQaHandoffGenerateRequest, force: true });

    expect(regen.status).toBe(201);
    expect(regen.body.status).toBe('READY');

    const approve = await request(app)
      .post(`${base}/approve`)
      .set('Cookie', sessionCookie)
      .send({ notes: 'AC verified' });

    expect(approve.status).toBe(200);
    expect(approve.body.status).toBe('APPROVED');
    expect(eventBus.getHistory().map((e) => e.type)).toContain('QA_HANDOFF_APPROVED');
  });

  it('returns 404 when handoff has not been generated', async () => {
    const { sessionCookie } = await loginAsUser(app);
    const workflow = await seedWorkflowForUser();

    const res = await request(app)
      .get(`/api/v1/workflows/${workflow._id.toString()}/qa-handoff`)
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('QaHandoffNotFound');
  });

  it('rejects request-changes without feedback items', async () => {
    const { sessionCookie } = await loginAsUser(app);
    const workflow = await seedWorkflowForUser();
    const base = `/api/v1/workflows/${workflow._id.toString()}/qa-handoff`;

    await request(app).post(base).set('Cookie', sessionCookie).send(sampleQaHandoffGenerateRequest);

    const res = await request(app)
      .post(`${base}/request-changes`)
      .set('Cookie', sessionCookie)
      .send({ feedbackItems: [] });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });
});
