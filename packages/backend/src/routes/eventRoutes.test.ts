import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { sampleChunkProgressEvent } from '@autodev/shared-types';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { sseManager } from '../services/events/sseManager.js';
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

async function loginAsUser(app: Application) {
  const login = await request(app)
    .post('/api/v1/auth/github/callback')
    .send({ code: 'mock-code', code_verifier: 'mock-verifier' });

  const cookieHeader = login.headers['set-cookie'];
  const sessionCookie = Array.isArray(cookieHeader)
    ? cookieHeader.find((cookie) => cookie.startsWith('autodev_session='))
    : undefined;
  const cookies = sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [];

  const me = await request(app).get('/api/v1/auth/me').set('Cookie', cookies);
  const body = me.body as { session: { userId: string } };

  return {
    login,
    sessionCookie: cookies,
    userId: body.session.userId,
  };
}

async function readSseUntilMatch(
  app: Application,
  sessionCookie: string[],
  matcher: (payload: string) => boolean,
  trigger: () => Promise<void>,
): Promise<string> {
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, resolve);
  });

  const { port } = server.address() as AddressInfo;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for SSE event'));
    }, 5_000);

    const chunks: string[] = [];

    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path: '/api/v1/events/stream',
        headers: { Cookie: sessionCookie.join('; ') },
      },
      (response) => {
        expect(response.statusCode).toBe(200);
        expect(response.headers['content-type']).toContain('text/event-stream');

        response.on('data', (chunk: Buffer) => {
          chunks.push(chunk.toString());
          const payload = chunks.join('');
          if (matcher(payload)) {
            clearTimeout(timeout);
            response.destroy();
            req.destroy();
            server.close();
            resolve(payload);
          }
        });

        void trigger().catch((error: unknown) => {
          clearTimeout(timeout);
          server.close();
          reject(error);
        });
      },
    );

    req.on('error', (error) => {
      clearTimeout(timeout);
      server.close();
      reject(error);
    });
  });
}

describe('event routes', () => {
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
  });

  afterEach(() => {
    sseManager.closeAllConnections();
  });

  it('requires authentication for the SSE stream', async () => {
    const app = createApp();

    const response = await request(app).get('/api/v1/events/stream');

    expect(response.status).toBe(401);
  });

  it('streams EventBus events to the authenticated user', async () => {
    const app = createApp();
    const { sessionCookie, userId } = await loginAsUser(app);

    const payload = await readSseUntilMatch(
      app,
      sessionCookie,
      (body) => body.includes('event: CHUNK_PROGRESS'),
      async () => {
        await request(app)
          .post('/api/v1/test/events/publish')
          .set('Cookie', sessionCookie)
          .send({
            ...sampleChunkProgressEvent,
            metadata: {
              ...sampleChunkProgressEvent.metadata,
              eventId: 'integration-event-1',
              userId,
            },
          });
      },
    );

    expect(payload).toContain('id: integration-event-1');
    expect(payload).toContain('event: CHUNK_PROGRESS');
    expect(payload).toContain('"progressPercent":45');
  });
});
