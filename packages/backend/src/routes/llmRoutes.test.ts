import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getLlmCacheModel } from '../models/llmCacheModel.js';
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

describe('llm routes', () => {
  beforeAll(async () => {
    process.env.LLM_PRIMARY_PROVIDER = 'local';
    process.env.LLM_FAILOVER_ORDER = 'local';
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getLlmCacheModel(),
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
    await getLlmCacheModel().deleteMany({});
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

  it('completes prompts via the local model stub and caches responses', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const first = await request(app)
      .post('/api/v1/llm/complete')
      .set('Cookie', sessionCookie)
      .send({ prompt: 'Explain camelCase preference', options: { provider: 'local' } });

    expect(first.status).toBe(200);
    expect(first.body.provider).toBe('local');
    expect(first.body.cached).toBe(false);

    const second = await request(app)
      .post('/api/v1/llm/complete')
      .set('Cookie', sessionCookie)
      .send({ prompt: 'Explain camelCase preference', options: { provider: 'local' } });

    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);

    const chat = await request(app)
      .post('/api/v1/llm/chat')
      .set('Cookie', sessionCookie)
      .send({
        messages: [
          { role: 'system', content: 'Be brief.' },
          { role: 'user', content: 'Recommend service-layer over MVC.' },
        ],
        options: { provider: 'local', cache: false },
      });

    expect(chat.status).toBe(200);
    expect(chat.body.content.length).toBeGreaterThan(0);

    const embed = await request(app)
      .post('/api/v1/llm/embed')
      .set('Cookie', sessionCookie)
      .send({ text: 'service-layer', options: { provider: 'local', cache: false } });

    expect(embed.status).toBe(200);
    expect(embed.body.embedding).toHaveLength(4);
  });
});
