import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleCriticalGaps,
  sampleExpectedNamingDivergence,
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
import { getDivergenceRecordModel } from '../models/divergenceRecordModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
import { getUserModel } from '../models/userModel.js';
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
    login,
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('approval routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getTicketIntentModel(),
      getDivergenceRecordModel(),
      getApprovalRequestModel(),
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
    await getTicketIntentModel().deleteMany({});
    await getDivergenceRecordModel().deleteMany({});
    await getApprovalRequestModel().deleteMany({});
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
      acceptanceCriteria: [],
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: sampleCriticalGaps,
      canProceedToAnalysis: false,
      createdBy: userId,
      updatedBy: userId,
    });

    const divergence = await getDivergenceRecordModel().create({
      userId,
      ticketKey,
      ticketIntentId: intent._id.toString(),
      codebaseContextId: 'context-route-001',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      workflowId: 'workflow-route',
      divergences: [sampleExpectedNamingDivergence],
      aligned: false,
      summary: 'Naming conflict detected',
      createdBy: userId,
      updatedBy: userId,
    });

    await getTicketIntentModel()
      .updateOne(
        { _id: intent._id },
        { $set: { latestDivergenceRecordId: divergence._id.toString() } },
      )
      .exec();
  }

  it('runs full approval lifecycle from creation through gate clearance', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    await seedTicketData(String(user!._id), 'OPL-6001');

    const created = await request(app)
      .post('/api/v1/tickets/OPL-6001/approvals')
      .set('Cookie', sessionCookie)
      .send({ workflowId: 'workflow-6001' });

    expect(created.status).toBe(201);
    expect(created.body.items).toHaveLength(2);

    const blocked = await request(app)
      .post(`/api/v1/test/workflow/${created.body.id}/proceed`)
      .set('Cookie', sessionCookie);

    expect(blocked.status).toBe(412);

    const statusPending = await request(app)
      .get(`/api/v1/approvals/${created.body.id}/status`)
      .set('Cookie', sessionCookie);

    expect(statusPending.status).toBe(200);
    expect(statusPending.body.canProceed).toBe(false);
    expect(statusPending.body.pendingCount).toBe(2);

    for (const item of created.body.items) {
      const resolve = await request(app)
        .post(`/api/v1/approvals/${created.body.id}/items/${item.itemId}/resolve`)
        .set('Cookie', sessionCookie)
        .send({
          action: item.type === 'divergence' ? 'modify' : 'approve',
          rationale: 'Reviewed by integration test',
          modifiedValue: item.type === 'divergence' ? 'Adopt codebase naming' : undefined,
        });

      expect(resolve.status).toBe(200);
    }

    const statusCleared = await request(app)
      .get(`/api/v1/approvals/${created.body.id}/status`)
      .set('Cookie', sessionCookie);

    expect(statusCleared.body.canProceed).toBe(true);
    expect(statusCleared.body.pendingCount).toBe(0);

    const detail = await request(app)
      .get(`/api/v1/approvals/${created.body.id}`)
      .set('Cookie', sessionCookie);

    expect(detail.status).toBe(200);
    expect(detail.body.status).toBe('cleared');

    const allowed = await request(app)
      .post(`/api/v1/test/workflow/${created.body.id}/proceed`)
      .set('Cookie', sessionCookie);

    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);

    const audits = await getAuditLogModel()
      .find({ resource: { $regex: `^approval_requests/${created.body.id}` } })
      .exec();
    expect(audits.length).toBeGreaterThanOrEqual(3);

    const resolvedEvents = eventBus
      .getHistory()
      .filter((event) => event.type === 'APPROVAL_RESOLVED');
    expect(resolvedEvents.length).toBeGreaterThanOrEqual(3);
  });
});
