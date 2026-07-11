import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { sampleNormalizedTicket, sampleTicketWithMissingAc } from '@autodev/shared-types';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
import { getUserModel } from '../models/userModel.js';
import { ticketService } from '../services/jira/ticketService.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';

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
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('ticket parse integration', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getTicketIntentModel(),
    ]);
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
    await getTicketIntentModel().deleteMany({});
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
  });

  it('parses tickets, persists intent, and returns gap analysis', async () => {
    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: sampleNormalizedTicket,
      source: 'jira-rest',
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/tickets/OPL-1234/parse')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.canProceedToAnalysis).toBe(true);
    expect(response.body.intent.ticketKey).toBe('OPL-1234');
    expect(response.body.gaps).toEqual([]);

    const persisted = await getTicketIntentModel().findOne({ ticketKey: 'OPL-1234' });
    expect(persisted?.canProceedToAnalysis).toBe(true);
  });

  it('returns critical gaps and blocks analysis readiness', async () => {
    vi.mocked(ticketService.getTicket).mockResolvedValue({
      ticket: sampleTicketWithMissingAc,
      source: 'jira-rest',
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/tickets/OPL-2001/parse')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.canProceedToAnalysis).toBe(false);
    expect(response.body.gaps[0]?.severity).toBe('critical');
  });
});
