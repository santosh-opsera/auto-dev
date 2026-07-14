import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sampleSmallRepoFiles, sampleSmallRepoTree } from '@autodev/shared-types';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getCodebaseContextModel } from '../models/codebaseContextModel.js';
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

describe('analysis routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getRepositoryConnectionModel(),
      getCodebaseContextModel(),
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
    await getRepositoryConnectionModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
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

    vi.spyOn(repositoryService, 'getRepositoryTree').mockResolvedValue({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      tree: sampleSmallRepoTree,
    });

    vi.spyOn(repositoryService, 'getRepositoryFile').mockImplementation(async (_user, _owner, _repo, path) => ({
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      path,
      encoding: 'utf-8' as const,
      content: sampleSmallRepoFiles[path] ?? 'export {};\n',
    }));
  });

  it('analyzes a connected repository and persists context', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    await getRepositoryConnectionModel().create({
      userId: String((await getUserModel().findOne({ email: 'alex.dev@example.com' }))!._id),
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      fullName: 'santosh-opsera/auto-dev',
      defaultBranch: 'main',
      connectedAt: new Date(),
      createdBy: 'test',
      updatedBy: 'test',
    });

    const response = await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/analyze')
      .set('Cookie', sessionCookie)
      .send({ ticketKey: 'OPL-32448', workflowId: 'workflow-001' });

    expect(response.status).toBe(200);
    expect(response.body.context.owner).toBe('santosh-opsera');
    expect(response.body.context.designPatterns.length).toBeGreaterThan(0);
    expect(response.body.cacheHit).toBe(false);
  });

  it('returns 412 when analyzing an unconnected repository', async () => {
    vi.mocked(repositoryService.getRepositoryTree).mockRestore();

    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/analyze')
      .set('Cookie', sessionCookie)
      .send({ workflowId: 'workflow-unconnected' });

    expect(response.status).toBe(412);
    expect(response.body.error).toBe('RepositoryNotConnected');
  });

  it('returns cached analysis when tree fingerprint is unchanged', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    await getRepositoryConnectionModel().create({
      userId: String((await getUserModel().findOne({ email: 'alex.dev@example.com' }))!._id),
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      fullName: 'santosh-opsera/auto-dev',
      defaultBranch: 'main',
      connectedAt: new Date(),
      createdBy: 'test',
      updatedBy: 'test',
    });

    const first = await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/analyze')
      .set('Cookie', sessionCookie)
      .send({ workflowId: 'workflow-001' });

    const second = await request(app)
      .post('/api/v1/repositories/santosh-opsera/auto-dev/analyze')
      .set('Cookie', sessionCookie)
      .send({ workflowId: 'workflow-002' });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.cacheHit).toBe(true);
    expect(second.body.persistedId).toBe(first.body.persistedId);
  });
});
