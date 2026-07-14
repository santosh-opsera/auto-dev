import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleDependencyScanRequest,
  samplePackageBumpNotifyRequest,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import {
  getDependencyEdgeModel,
  getDependencyUpdateProposalModel,
} from '../models/dependencyTrackingModel.js';
import { getSessionModel } from '../models/sessionModel.js';
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
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('dependency tracking routes', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getDependencyEdgeModel(),
      getDependencyUpdateProposalModel(),
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
    await getDependencyEdgeModel().deleteMany({});
    await getDependencyUpdateProposalModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    eventBus.clearHistory();

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

  it('runs full tracking flow: scan → bump notify → consumers → outdated', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const scan = await request(app)
      .post('/api/v1/packages/dependency-scan')
      .set('Cookie', sessionCookie)
      .send(sampleDependencyScanRequest);

    expect(scan.status).toBe(201);
    expect(scan.body.graph.edgeCount).toBeGreaterThanOrEqual(6);

    const notify = await request(app)
      .post('/api/v1/packages/dependency-updates/notify')
      .set('Cookie', sessionCookie)
      .send(samplePackageBumpNotifyRequest);

    expect(notify.status).toBe(201);
    expect(notify.body.consumersIdentified).toBe(3);
    expect(notify.body.proposals).toHaveLength(3);

    const consumersEncoded = await request(app)
      .get(`/api/v1/packages/${encodeURIComponent('@autodev/shared-utils')}/consumers`)
      .set('Cookie', sessionCookie);

    expect(consumersEncoded.status).toBe(200);
    expect(consumersEncoded.body.count).toBe(3);
    expect(consumersEncoded.body.packageName).toBe('@autodev/shared-utils');

    const consumersPath = await request(app)
      .get('/api/v1/packages/@autodev/shared-utils/consumers')
      .set('Cookie', sessionCookie);

    expect(consumersPath.status).toBe(200);
    expect(consumersPath.body.count).toBe(3);

    const outdated = await request(app)
      .get('/api/v1/repositories/acme/web-app/outdated-dependencies')
      .set('Cookie', sessionCookie);

    expect(outdated.status).toBe(200);
    expect(outdated.body.count).toBe(1);
    expect(outdated.body.outdated[0]).toMatchObject({
      packageName: '@autodev/shared-utils',
      currentVersion: '^1.2.3',
      proposedVersion: '1.3.0',
    });
    expect(outdated.body.outdated[0].changelogLink).toBeTruthy();

    const list = await request(app)
      .get('/api/v1/packages/dependency-updates')
      .set('Cookie', sessionCookie);

    expect(list.status).toBe(200);
    expect(list.body.proposals).toHaveLength(3);

    const events = eventBus.getHistory().filter((e) => e.type === 'DEPENDENCY_UPDATE_AVAILABLE');
    expect(events).toHaveLength(3);
  });

  it('requires auth for consumers and outdated endpoints', async () => {
    const consumers = await request(app).get(
      '/api/v1/packages/@autodev/shared-utils/consumers',
    );
    expect(consumers.status).toBe(401);

    const outdated = await request(app).get(
      '/api/v1/repositories/acme/web-app/outdated-dependencies',
    );
    expect(outdated.status).toBe(401);
  });
});
