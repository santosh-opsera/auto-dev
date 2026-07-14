import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sampleGitHubRepositories } from '@autodev/shared-types';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getRepositoryConnectionModel } from '../models/repositoryConnectionModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { repositoryService } from '../services/github/repositoryService.js';

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
    login,
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('repository routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getRepositoryConnectionModel(),
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
    await getRepositoryConnectionModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    vi.restoreAllMocks();

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

  it('lists repositories for authenticated users after OAuth with optional rate-limit warning', async () => {
    vi.spyOn(repositoryService, 'listRepositories').mockResolvedValue({
      repositories: sampleGitHubRepositories,
      pagination: {
        page: 1,
        perPage: 30,
        totalCount: sampleGitHubRepositories.length,
        hasNextPage: false,
      },
      rateLimit: {
        limit: 5000,
        remaining: 42,
        resetAt: '2026-07-14T12:30:00.000Z',
        queuedRequests: 0,
      },
      rateLimitWarning: 'GitHub API rate limit is low (42 of 5000 remaining).',
    });

    const app = createApp();
    const { sessionCookie, login } = await loginAsUser(app);
    expect(login.status).toBe(200);

    const response = await request(app)
      .get('/api/v1/repositories')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.repositories[0].fullName).toBe('santosh-opsera/auto-dev');
    expect(response.body.rateLimitWarning).toMatch(/rate limit is low/i);
    expect(response.body.rateLimit.remaining).toBe(42);
    expect(response.body.pagination).toEqual({
      page: 1,
      perPage: 30,
      totalCount: sampleGitHubRepositories.length,
      hasNextPage: false,
    });
  });

  it('returns paginated repository slices for page and perPage query params', async () => {
    vi.spyOn(repositoryService, 'listRepositories').mockImplementation(async (_user, options) => {
      const page = options?.page ?? 1;
      const perPage = options?.perPage ?? 30;
      return {
        repositories: sampleGitHubRepositories.slice(0, 1),
        pagination: {
          page,
          perPage,
          totalCount: 150,
          hasNextPage: page * perPage < 150,
        },
      };
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/repositories?page=2&perPage=50')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(repositoryService.listRepositories).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ page: 2, perPage: 50, refresh: false }),
    );
    expect(response.body.pagination).toEqual({
      page: 2,
      perPage: 50,
      totalCount: 150,
      hasNextPage: true,
    });
  });

  it('passes refresh=true to invalidate repository list cache', async () => {
    vi.spyOn(repositoryService, 'listRepositories').mockResolvedValue({
      repositories: sampleGitHubRepositories,
      pagination: {
        page: 1,
        perPage: 30,
        totalCount: sampleGitHubRepositories.length,
        hasNextPage: false,
      },
      fromCache: false,
      cachedAt: '2026-07-14T12:00:00.000Z',
      cacheExpiresAt: '2026-07-14T12:05:00.000Z',
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/repositories?refresh=true')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(repositoryService.listRepositories).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ refresh: true }),
    );
    expect(response.body.fromCache).toBe(false);
  });

  it('connects a repository and returns tree/file data', async () => {
    vi.spyOn(repositoryService, 'connectRepository').mockResolvedValue({
      connection: {
        id: 'conn-1',
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        fullName: 'santosh-opsera/auto-dev',
        defaultBranch: 'main',
        connectedAt: '2026-07-11T08:00:00.000Z',
      },
    });
    vi.spyOn(repositoryService, 'getRepositoryTree').mockResolvedValue({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      tree: [{ path: 'README.md', type: 'file', sha: 'def456', size: 512 }],
    });
    vi.spyOn(repositoryService, 'getRepositoryFile').mockResolvedValue({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      path: 'README.md',
      encoding: 'utf-8',
      content: '# AutoDev',
      sha: 'def456',
      size: 512,
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const connect = await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/connect')
      .set('Cookie', sessionCookie);

    expect(connect.status).toBe(200);
    expect(connect.body.connection.fullName).toBe('santosh-opsera/auto-dev');

    const tree = await request(app)
      .get('/api/v1/repositories/santosh-opsera/auto-dev/tree')
      .set('Cookie', sessionCookie);

    expect(tree.status).toBe(200);
    expect(tree.body.tree).toHaveLength(1);

    const file = await request(app)
      .get('/api/v1/repositories/santosh-opsera/auto-dev/files/README.md')
      .set('Cookie', sessionCookie);

    expect(file.status).toBe(200);
    expect(file.body.content).toContain('AutoDev');
  });

  it('returns 412 when fetching tree for an unconnected repository', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/repositories/santosh-opsera/auto-dev/tree')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(412);
    expect(response.body.error).toBe('RepositoryNotConnected');
  });

  it('lists connected repositories for the signed-in user', async () => {
    vi.spyOn(repositoryService, 'connectRepository').mockResolvedValue({
      connection: {
        id: 'conn-1',
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        fullName: 'santosh-opsera/auto-dev',
        defaultBranch: 'main',
        connectedAt: '2026-07-11T08:00:00.000Z',
      },
    });
    vi.spyOn(repositoryService, 'listConnectedRepositories').mockResolvedValue({
      connections: [
        {
          id: 'conn-1',
          owner: 'santosh-opsera',
          repo: 'auto-dev',
          fullName: 'santosh-opsera/auto-dev',
          defaultBranch: 'main',
          connectedAt: '2026-07-11T08:00:00.000Z',
        },
      ],
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/connect')
      .set('Cookie', sessionCookie);

    const response = await request(app)
      .get('/api/v1/repositories/connected')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.connections).toHaveLength(1);
  });

  it('exposes GitHub rate limit status', async () => {
    vi.spyOn(repositoryService, 'getRateLimitStatus').mockReturnValue({
      limit: 5000,
      remaining: 4999,
      resetAt: new Date(Date.now() + 3600_000).toISOString(),
      queuedRequests: 0,
    });

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/repositories/rate-limit')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.remaining).toBe(4999);
  });
});
