import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sampleDeploymentCreateRequest } from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getDeploymentModel } from '../models/deploymentModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { eventBus } from '../services/events/eventBus.js';
import { MockDockerClient } from '../services/deployment/dockerClient.js';
import { MockHealthChecker } from '../services/deployment/healthCheck.js';
import { deploymentService } from '../services/deployment/deploymentService.js';

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

describe('deployment routes', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getDeploymentModel(),
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
    await getDeploymentModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);

    deploymentService.setDeps({
      dockerClient: new MockDockerClient({ scenario: 'success' }),
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
      healthMaxAttempts: 3,
      healthDelayMs: 0,
    });

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

  it('rejects deployment without confirmationToken', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const res = await request(app)
      .post('/api/v1/deployments')
      .set('Cookie', sessionCookie)
      .send({
        workflowId: 'workflow-001',
        branch: 'feature/qa-handoff',
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('runs full deploy → get → stop lifecycle with mock Docker', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const create = await request(app)
      .post('/api/v1/deployments')
      .set('Cookie', sessionCookie)
      .send({
        ...sampleDeploymentCreateRequest,
        projectDir: '/tmp/autodev-qa',
      });

    expect(create.status).toBe(201);
    expect(create.body.status).toBe('RUNNING');
    expect(create.body.confirmed).toBe(true);
    expect(create.body.baseUrl).toBe('http://localhost:4000');

    const get = await request(app)
      .get(`/api/v1/deployments/${create.body.id}`)
      .set('Cookie', sessionCookie);

    expect(get.status).toBe(200);
    expect(get.body.id).toBe(create.body.id);
    expect(get.body.status).toBe('RUNNING');

    const stop = await request(app)
      .post(`/api/v1/deployments/${create.body.id}/stop`)
      .set('Cookie', sessionCookie);

    expect(stop.status).toBe(200);
    expect(stop.body.status).toBe('STOPPED');

    const eventTypes = eventBus.getHistory().map((e) => e.type);
    expect(eventTypes).toContain('DEPLOYMENT_STARTED');
    expect(eventTypes).toContain('DEPLOYMENT_COMPLETED');
  });

  it('returns FAILED payload with logs when mock Docker build fails', async () => {
    deploymentService.setDeps({
      dockerClient: new MockDockerClient({
        scenario: 'build_failure',
        buildStdout: 'npm ERR! mock\n',
        buildStderr: 'ERROR: failed to solve\n',
      }),
      healthChecker: new MockHealthChecker(),
      awaitPipeline: true,
      healthMaxAttempts: 3,
      healthDelayMs: 0,
    });

    const { sessionCookie } = await loginAsUser(app);

    const create = await request(app)
      .post('/api/v1/deployments')
      .set('Cookie', sessionCookie)
      .send({
        ...sampleDeploymentCreateRequest,
        confirmationToken: 'confirm-route-fail',
        projectDir: '/tmp/autodev-qa',
      });

    expect(create.status).toBe(201);
    expect(create.body.status).toBe('FAILED');
    expect(create.body.logs).toBeTruthy();
    expect(create.body.error.code).toBe('DEPLOY_BUILD_FAILED');
    expect(eventBus.getHistory().map((e) => e.type)).toContain('DEPLOYMENT_FAILED');
  });

  it('requires authentication', async () => {
    const res = await request(app).post('/api/v1/deployments').send(sampleDeploymentCreateRequest);
    expect(res.status).toBe(401);
  });
});
