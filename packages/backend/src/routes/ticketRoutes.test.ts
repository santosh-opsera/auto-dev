import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { sampleNormalizedTicket } from '../fixtures/jira.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { ticketService } from '../services/jira/ticketService.js';

vi.mock('../services/auth/githubAuthService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/auth/githubAuthService.js')>();
  return {
    ...actual,
    exchangeGitHubCode: vi.fn(),
  };
});

vi.mock('../services/jira/ticketService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/jira/ticketService.js')>();
  return {
    ...actual,
    ticketService: {
      getTicket: vi.fn(),
    },
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

describe('ticket routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([getUserModel(), getSessionModel(), getAuditLogModel()]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    resetAuthRateLimits();
    resetLockouts();
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
      scopes: ['read:user', 'user:email'],
    });

    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: sampleNormalizedTicket,
      source: 'jira-rest',
      fallbackUsed: true,
    });
  });

  it('requires authentication', async () => {
    const app = createApp();
    const response = await request(app).get('/api/v1/tickets/OPL-1234');
    expect(response.status).toBe(401);
  });

  it('validates ticket key format', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/tickets/OPL%201234')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(400);
  });

  it('returns normalized ticket JSON for authenticated users', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/tickets/OPL-1234')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      ticket: sampleNormalizedTicket,
      source: 'jira-rest',
      fallbackUsed: true,
    });
    expect(ticketService.getTicket).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alex.dev@example.com' }),
      'OPL-1234',
    );
  });

  it('supports manual fallback ticket retrieval', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/tickets/manual')
      .set('Cookie', sessionCookie)
      .send({ ticketKey: 'OPL-1234' });

    expect(response.status).toBe(200);
    expect(ticketService.getTicket).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alex.dev@example.com' }),
      'OPL-1234',
      true,
    );
  });
});
