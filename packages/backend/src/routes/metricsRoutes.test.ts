import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  expectedAggregatedMetrics30d,
  expectedWorkflowAMetrics,
  metricsWorkflowAId,
  metricsWorkflowBId,
  sampleMetricsDomainEvents,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowMetricsModel } from '../models/workflowMetricsModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { eventBus } from '../services/events/eventBus.js';
import { metricsCollectionService } from '../services/metrics/metricsCollectionService.js';

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
  const cookies = sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [];

  const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookies);
  const body = me.body as { session: { userId: string } };

  return {
    sessionCookie: cookies,
    userId: body.session.userId,
  };
}

describe('metrics routes integration', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowMetricsModel(),
    ]);
    metricsCollectionService.initialize(eventBus);
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
    await getWorkflowMetricsModel().deleteMany({});
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

  it('collects metrics from EventBus events and serves aggregated + per-workflow APIs', async () => {
    const { sessionCookie, userId } = await loginAsUser(app);

    for (const event of sampleMetricsDomainEvents) {
      await eventBus.publish(
        {
          ...event,
          metadata: {
            ...event.metadata,
            userId,
            actor: userId,
          },
        },
        { awaitHandlers: true },
      );
    }

    const workflowA = await request(app)
      .get(`/api/v1/metrics/workflows/${metricsWorkflowAId}`)
      .set('Cookie', sessionCookie);

    expect(workflowA.status).toBe(200);
    expect(workflowA.body).toMatchObject({
      workflowId: expectedWorkflowAMetrics.workflowId,
      startedAt: expectedWorkflowAMetrics.startedAt,
      completedAt: expectedWorkflowAMetrics.completedAt,
      timeFromTicketToPrMs: expectedWorkflowAMetrics.timeFromTicketToPrMs,
      reachedPrCreated: true,
      currentStage: 'PR_CREATED',
      conventionAdherence: expectedWorkflowAMetrics.conventionAdherence,
      aiGeneratedTestPassRate: expectedWorkflowAMetrics.aiGeneratedTestPassRate,
    });
    expect(workflowA.body.stageTimings).toEqual(expectedWorkflowAMetrics.stageTimings);

    const workflowB = await request(app)
      .get(`/api/v1/metrics/workflows/${metricsWorkflowBId}`)
      .set('Cookie', sessionCookie);

    expect(workflowB.status).toBe(200);
    expect(workflowB.body.reachedPrCreated).toBe(false);
    expect(workflowB.body.conventionAdherence).toEqual({
      ratePercent: 0,
      numerator: 0,
      denominator: 2,
    });
    expect(workflowB.body.aiGeneratedTestPassRate).toEqual({
      ratePercent: 75,
      numerator: 6,
      denominator: 8,
    });

    const aggregated = await request(app)
      .get('/api/v1/metrics')
      .query({ period: '90d' })
      .set('Cookie', sessionCookie);

    expect(aggregated.status).toBe(200);
    expect(aggregated.body.period).toBe('90d');
    expect(aggregated.body.timeFromTicketToPr).toEqual(
      expectedAggregatedMetrics30d.timeFromTicketToPr,
    );
    expect(aggregated.body.conventionAdherence).toEqual(
      expectedAggregatedMetrics30d.conventionAdherence,
    );
    expect(aggregated.body.aiGeneratedTestPassRate).toEqual(
      expectedAggregatedMetrics30d.aiGeneratedTestPassRate,
    );
    expect(aggregated.body.workflowCompletionRate).toEqual(
      expectedAggregatedMetrics30d.workflowCompletionRate,
    );
    expect(aggregated.body.totals).toEqual(expectedAggregatedMetrics30d.totals);
  });

  it('rejects unauthenticated metrics access and unknown workflows', async () => {
    const unauthenticated = await request(app).get('/api/v1/metrics');
    expect(unauthenticated.status).toBe(401);

    const { sessionCookie } = await loginAsUser(app);
    const missing = await request(app)
      .get('/api/v1/metrics/workflows/does-not-exist')
      .set('Cookie', sessionCookie);
    expect(missing.status).toBe(404);

    const badPeriod = await request(app)
      .get('/api/v1/metrics')
      .query({ period: '1d' })
      .set('Cookie', sessionCookie);
    expect(badPeriod.status).toBe(400);
  });
});
