import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { adapterRegistry } from '../services/integrations/adapterRegistry.js';
import {
  bootstrapIntegrationAdapters,
  registerDefaultAdapters,
} from '../services/integrations/registerDefaultAdapters.js';

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

describe('integration routes', () => {
  const app = createApp();

  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getUserModel(), getSessionModel(), getAuditLogModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    await resetLockouts();
    adapterRegistry.reset();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
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

  afterEach(() => {
    adapterRegistry.reset();
  });

  it('requires authentication', async () => {
    const res = await request(app).get('/api/v1/integrations');
    expect(res.status).toBe(401);
  });

  it('returns registered adapters with status and capabilities', async () => {
    await bootstrapIntegrationAdapters();
    adapterRegistry.stopPeriodicHealthChecks();

    const { sessionCookie } = await loginAsUser(app);
    const res = await request(app).get('/api/v1/integrations').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.adapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'jira',
          status: 'active',
          capabilities: expect.arrayContaining(['ticket-ingest']),
        }),
        expect.objectContaining({
          name: 'github',
          status: 'active',
          capabilities: expect.arrayContaining(['repository-access']),
        }),
        expect.objectContaining({
          name: 'opsera',
          status: 'inactive',
          capabilities: ['coming soon'],
          message: 'coming soon',
        }),
      ]),
    );
    expect(res.body.adapters).toHaveLength(3);
  });

  it('registers default adapters on demand without core route changes', async () => {
    registerDefaultAdapters();
    expect(adapterRegistry.has('jira')).toBe(true);
    expect(adapterRegistry.has('github')).toBe(true);
    expect(adapterRegistry.has('opsera')).toBe(true);

    // Idempotent — second call does not throw.
    registerDefaultAdapters();

    const { sessionCookie } = await loginAsUser(app);
    const res = await request(app).get('/api/v1/integrations').set('Cookie', sessionCookie);
    expect(res.status).toBe(200);
    expect(res.body.adapters.map((a: { name: string }) => a.name).sort()).toEqual([
      'github',
      'jira',
      'opsera',
    ]);
  });
});
