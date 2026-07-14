import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { sampleAuditLogEntries } from '../fixtures/audit.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { auditLogRepository } from '../repositories/auditLogRepository.js';
import { auditService } from '../services/audit/auditService.js';

vi.mock('../services/auth/githubAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/githubAuthService.js')>();
  return {
    ...actual,
    exchangeGitHubCode: vi.fn(),
  };
});

import { exchangeGitHubCode } from '../services/auth/githubAuthService.js';

describe('audit routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getAuditLogModel(), getUserModel(), getSessionModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    await resetLockouts();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().collection.deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);

    for (const entry of sampleAuditLogEntries) {
      await auditLogRepository.append(entry);
    }

    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: 'dana.lead@example.com',
      displayName: 'Dana Team Lead',
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email'],
    });
  });

  it('query service returns records for seeded audit data', async () => {
    const result = await auditService.query({}, 1, 50);
    expect(result.total).toBeGreaterThan(0);
    expect(result.records[0]?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns paginated audit logs for admin users', async () => {
    const app = createApp();
    const admin = await getUserModel().findOne({ email: 'dana.lead@example.com' }).exec();
    expect(admin?.role).toBe('admin');

    const adminSession = await getSessionModel().create({
      sessionId: 'admin-audit-session',
      userId: String(admin?._id),
      refreshTokenHash: 'hash',
      expiresAt: new Date(Date.now() + 60_000),
      lastActivityAt: new Date(),
      dataClassification: 'confidential',
    });

    const response = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', [`autodev_session=${adminSession.sessionId}`]);

    expect(response.status).toBe(200);
    expect(response.body.total).toBeGreaterThanOrEqual(1);
    expect(
      response.body.records.some((record: { operation: string }) => record.operation === 'login'),
    ).toBe(true);
  });

  it('rejects non-admin users', async () => {
    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: mockGitHubUserResponse.email ?? 'alex.dev@example.com',
      displayName: mockGitHubUserResponse.name ?? mockGitHubUserResponse.login,
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email'],
    });

    const app = createApp();
    const login = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    const cookieHeader = login.headers['set-cookie'];
    const sessionCookie = Array.isArray(cookieHeader)
      ? cookieHeader.find((cookie) => cookie.startsWith('autodev_session='))
      : undefined;

    const response = await request(app)
      .get('/api/v1/audit')
      .set('Cookie', sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : []);

    expect(response.status).toBe(403);
  });
});

describe('audit integration', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getAuditLogModel(), getUserModel(), getSessionModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    await resetLockouts();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().collection.deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);

    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: 'dana.lead@example.com',
      displayName: 'Dana Team Lead',
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email'],
    });
  });

  it('records auth login events and mutation audit entries retrievable via audit API', async () => {
    const app = createApp();

    const login = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    expect(login.status).toBe(200);

    const cookieHeader = login.headers['set-cookie'];
    const sessionCookie = Array.isArray(cookieHeader)
      ? cookieHeader.find((cookie) => cookie.startsWith('autodev_session='))
      : undefined;

    const mutation = await request(app)
      .post('/api/v1/test/mutation')
      .set('Cookie', sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : []);

    expect(mutation.status).toBe(201);

    const audit = await request(app)
      .get('/api/v1/audit?resource=convention_settings/test-001')
      .set('Cookie', sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : []);

    expect(audit.status).toBe(200);
    expect(audit.body.total).toBe(1);
    expect(audit.body.records[0]).toMatchObject({
      resource: 'convention_settings/test-001',
      operation: 'create',
    });

    const loginAudit = await getAuditLogModel().findOne({ operation: 'login' }).exec();
    expect(loginAudit).toBeTruthy();
  });
});
