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
    await resetAuthRateLimits();
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

  it('GET /status requires authentication', async () => {
    const res = await request(app).get('/api/v1/integrations/status');
    expect(res.status).toBe(401);
  });

  it('GET /status returns GitHub and Jira health shape with last check, token validity, and connection state', async () => {
    await bootstrapIntegrationAdapters();
    adapterRegistry.stopPeriodicHealthChecks();

    const { sessionCookie } = await loginAsUser(app);

    // Default login user has GitHub login scopes but may lack repo tokens until set.
    await getUserModel().updateOne(
      { email: 'alex.dev@example.com' },
      {
        $set: {
          github: {
            providerUserId: String(mockGitHubUserResponse.id),
            encryptedAccessToken: 'enc:github-access',
            scopes: ['read:user', 'user:email', 'repo'],
            tokenExpiresAt: new Date(Date.now() + 86_400_000),
          },
          atlassian: {
            providerUserId: 'atlassian-001',
            encryptedAccessToken: 'enc:atlassian-access',
            encryptedRefreshToken: 'enc:atlassian-refresh',
            scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
            tokenExpiresAt: new Date(Date.now() + 3_600_000),
          },
          connectedProviders: ['github', 'atlassian'],
        },
      },
    );

    const res = await request(app).get('/api/v1/integrations/status').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        github: expect.objectContaining({
          name: 'github',
          connected: true,
          tokenValid: true,
          connectionState: 'connected',
          lastCheckedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
        jira: expect.objectContaining({
          name: 'jira',
          connected: true,
          tokenValid: true,
          connectionState: 'connected',
          lastCheckedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        }),
      }),
    );
  });

  it('GET /status reports GitHub disconnected when encryptedAccessToken is missing', async () => {
    await bootstrapIntegrationAdapters();
    adapterRegistry.stopPeriodicHealthChecks();

    const { sessionCookie } = await loginAsUser(app);
    await getUserModel().updateOne(
      { email: 'alex.dev@example.com' },
      { $unset: { github: 1 } },
    );

    const res = await request(app).get('/api/v1/integrations/status').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.github).toMatchObject({
      connected: false,
      tokenValid: false,
      connectionState: 'disconnected',
      message: 'GitHub not connected',
    });
  });

  it('GET /status reports Jira expired when tokenExpiresAt is in the past', async () => {
    await bootstrapIntegrationAdapters();
    adapterRegistry.stopPeriodicHealthChecks();

    const { sessionCookie } = await loginAsUser(app);
    await getUserModel().updateOne(
      { email: 'alex.dev@example.com' },
      {
        $set: {
          github: {
            providerUserId: String(mockGitHubUserResponse.id),
            encryptedAccessToken: 'enc:github-access',
            scopes: ['read:user', 'user:email', 'repo'],
            tokenExpiresAt: new Date(Date.now() + 86_400_000),
          },
          atlassian: {
            providerUserId: 'atlassian-001',
            encryptedAccessToken: 'enc:atlassian-access',
            encryptedRefreshToken: 'enc:atlassian-refresh',
            scopes: ['read:me', 'offline_access', 'read:jira-work', 'read:jira-user'],
            tokenExpiresAt: new Date(Date.now() - 60_000),
          },
          connectedProviders: ['github', 'atlassian'],
        },
      },
    );

    const res = await request(app).get('/api/v1/integrations/status').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body.jira).toMatchObject({
      connected: true,
      tokenValid: false,
      connectionState: 'expired',
      message: 'Jira connection expired — Reconnect',
    });
  });
});
