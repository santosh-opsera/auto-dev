import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { LOCKOUT_THRESHOLD } from '../auth/constants.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import {
  mockAtlassianTokenResponse,
  mockAtlassianUserResponse,
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { createApp } from '../index.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';

vi.mock('../services/auth/githubAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/githubAuthService.js')>();
  return {
    ...actual,
    exchangeGitHubCode: vi.fn(),
  };
});

vi.mock('../services/auth/atlassianAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/atlassianAuthService.js')>();
  return {
    ...actual,
    exchangeAtlassianCode: vi.fn(),
  };
});

import { exchangeGitHubCode } from '../services/auth/githubAuthService.js';
import { exchangeAtlassianCode } from '../services/auth/atlassianAuthService.js';

describe('auth routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    resetLockouts();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    vi.mocked(exchangeGitHubCode).mockResolvedValue({
      provider: 'github',
      providerUserId: String(mockGitHubUserResponse.id),
      email: mockGitHubUserResponse.email ?? 'alex.dev@example.com',
      displayName: mockGitHubUserResponse.name ?? mockGitHubUserResponse.login,
      accessToken: mockGitHubTokenResponse.access_token,
      refreshToken: mockGitHubTokenResponse.refresh_token,
      scopes: ['read:user', 'user:email'],
    });
    vi.mocked(exchangeAtlassianCode).mockResolvedValue({
      provider: 'atlassian',
      providerUserId: mockAtlassianUserResponse.account_id,
      email: mockAtlassianUserResponse.email,
      displayName: mockAtlassianUserResponse.name,
      accessToken: mockAtlassianTokenResponse.access_token,
      refreshToken: mockAtlassianTokenResponse.refresh_token,
      scopes: ['read:me', 'offline_access'],
    });
  });

  it('creates a session cookie on GitHub callback', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    expect(response.status).toBe(200);
    const body = response.body as { user: { email: string } };
    expect(body.user.email).toBe('alex.dev@example.com');
    const cookieHeader = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie'].join(';')
      : '';
    expect(cookieHeader).toContain('autodev_session=');
    expect(cookieHeader).toContain('HttpOnly');
    expect(cookieHeader).toContain('SameSite=Strict');
  });

  it('rotates refresh tokens and extends heartbeat metadata', async () => {
    const app = createApp();
    const login = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    const cookies = login.headers['set-cookie'];

    const refresh = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookies);
    const refreshBody = refresh.body as { session: { remainingMs: number } };
    expect(refresh.status).toBe(200);
    expect(refreshBody.session.remainingMs).toBeGreaterThan(0);

    const heartbeat = await request(app)
      .post('/api/v1/auth/heartbeat')
      .set('Cookie', refresh.headers['set-cookie'] ?? cookies);
    const heartbeatBody = heartbeat.body as { session: { remainingMs: number } };
    expect(heartbeat.status).toBe(200);
    expect(typeof heartbeatBody.session.remainingMs).toBe('number');
  });

  it('logs out and clears the session cookie', async () => {
    const app = createApp();
    const login = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    const logout = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', login.headers['set-cookie']);

    expect(logout.status).toBe(204);
  });

  it('locks out repeated failed authentication attempts', async () => {
    vi.mocked(exchangeGitHubCode).mockRejectedValue(new Error('invalid'));
    const app = createApp();

    for (let attempt = 0; attempt < LOCKOUT_THRESHOLD; attempt += 1) {
      await request(app)
        .post('/api/v1/auth/github/callback')
        .send({ code: 'bad-code', code_verifier: 'bad-verifier' });
    }

    const locked = await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'bad-code', code_verifier: 'bad-verifier' });

    expect(locked.status).toBe(423);
  });

  it('creates a session cookie on Atlassian callback', async () => {
    const app = createApp();
    const response = await request(app)
      .post('/api/v1/auth/atlassian/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    expect(response.status).toBe(200);
    const body = response.body as { user: { email: string; connectedProviders: string[] } };
    expect(body.user.email).toBe('alex.dev@example.com');
    expect(body.user.connectedProviders).toContain('atlassian');
  });

  it('links Atlassian provider to an existing GitHub user by email', async () => {
    const app = createApp();

    await request(app)
      .post('/api/v1/auth/github/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    const linked = await request(app)
      .post('/api/v1/auth/atlassian/callback')
      .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

    const body = linked.body as { user: { connectedProviders: string[] } };
    expect(linked.status).toBe(200);
    expect(body.user.connectedProviders).toEqual(
      expect.arrayContaining(['github', 'atlassian']),
    );

    const users = await getUserModel().find({ email: 'alex.dev@example.com' }).exec();
    expect(users).toHaveLength(1);
  });
});
