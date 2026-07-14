import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleDetectRequest,
  samplePackageSnapshotBlocked,
  samplePackageSnapshotPublishable,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getPackagePublishProposalModel } from '../models/packagePublishProposalModel.js';
import { getSessionModel } from '../models/sessionModel.js';
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

describe('package routes', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getPackagePublishProposalModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    await resetLockouts();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getPackagePublishProposalModel().deleteMany({});
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

  it('runs full detection-to-proposal-to-confirm-to-publish flow', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const detect = await request(app)
      .post('/api/v1/packages/detect')
      .set('Cookie', sessionCookie)
      .send(sampleDetectRequest);

    expect(detect.status).toBe(201);
    expect(detect.body.proposals).toHaveLength(1);

    const proposal = detect.body.proposals[0];
    expect(proposal.packageName).toBe('@autodev/shared-utils');
    expect(proposal.currentVersion).toBe('1.2.3');
    expect(proposal.proposedVersion).toBe('1.3.0');
    expect(proposal.changelog).toBeTruthy();
    expect(proposal.vulnerabilityScan).toBeTruthy();
    expect(proposal.confirmationToken).toBeTruthy();

    const get = await request(app)
      .get(`/api/v1/packages/proposals/${proposal.id}`)
      .set('Cookie', sessionCookie);

    expect(get.status).toBe(200);
    expect(get.body.id).toBe(proposal.id);
    expect(get.body.confirmationToken).toBeUndefined();

    const publishTooEarly = await request(app)
      .post(`/api/v1/packages/proposals/${proposal.id}/publish`)
      .set('Cookie', sessionCookie)
      .send({ confirmationToken: proposal.confirmationToken });

    expect(publishTooEarly.status).toBe(409);
    expect(publishTooEarly.body.error).toBe('PackagePublishNotConfirmed');

    const confirm = await request(app)
      .post(`/api/v1/packages/proposals/${proposal.id}/confirm`)
      .set('Cookie', sessionCookie)
      .send({ confirmationToken: proposal.confirmationToken });

    expect(confirm.status).toBe(200);
    expect(confirm.body.status).toBe('confirmed');

    const publish = await request(app)
      .post(`/api/v1/packages/proposals/${proposal.id}/publish`)
      .set('Cookie', sessionCookie)
      .send({ confirmationToken: proposal.confirmationToken });

    expect(publish.status).toBe(200);
    expect(publish.body.status).toBe('published');
    expect(publish.body.publishSimulation.simulated).toBe(true);
  });

  it('blocks publish path when audit findings exceed threshold', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const detect = await request(app)
      .post('/api/v1/packages/detect')
      .set('Cookie', sessionCookie)
      .send({
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        changedFiles: sampleDetectRequest.changedFiles,
        packageSnapshots: [samplePackageSnapshotBlocked],
        severityThreshold: 'high',
      });

    expect(detect.status).toBe(201);
    expect(detect.body.proposals[0].status).toBe('blocked');

    const id = detect.body.proposals[0].id;
    const confirm = await request(app)
      .post(`/api/v1/packages/proposals/${id}/confirm`)
      .set('Cookie', sessionCookie)
      .send({ confirmationToken: 'irrelevant' });

    expect(confirm.status).toBe(409);
    expect(confirm.body.error).toBe('PackagePublishBlocked');
  });

  it('requires session and validation', async () => {
    const unauth = await request(app).post('/api/v1/packages/detect').send(sampleDetectRequest);
    expect(unauth.status).toBe(401);

    const { sessionCookie } = await loginAsUser(app);
    const invalid = await request(app)
      .post('/api/v1/packages/detect')
      .set('Cookie', sessionCookie)
      .send({ owner: 'acme', repo: 'widgets', changedFiles: [] });

    expect(invalid.status).toBe(400);
  });

  it('rejects invalid confirmation tokens', async () => {
    const { sessionCookie } = await loginAsUser(app);

    const detect = await request(app)
      .post('/api/v1/packages/detect')
      .set('Cookie', sessionCookie)
      .send({
        ...sampleDetectRequest,
        packageSnapshots: [samplePackageSnapshotPublishable],
      });

    const id = detect.body.proposals[0].id;
    const confirm = await request(app)
      .post(`/api/v1/packages/proposals/${id}/confirm`)
      .set('Cookie', sessionCookie)
      .send({ confirmationToken: 'not-the-real-token' });

    expect(confirm.status).toBe(403);
    expect(confirm.body.error).toBe('InvalidConfirmationToken');
  });
});
