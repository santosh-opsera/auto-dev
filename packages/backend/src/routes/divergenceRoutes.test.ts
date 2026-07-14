import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleAutoDevLikeContext,
  sampleNamingConflictTicketIntent,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getCodebaseContextModel, buildAnalysisExpiryDate } from '../models/codebaseContextModel.js';
import { getDivergenceRecordModel } from '../models/divergenceRecordModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
import { getUserModel } from '../models/userModel.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { ensureIndexes } from '../database/indexes.js';
import { eventBus } from '@autodev/infrastructure';

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

describe('divergence routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getTicketIntentModel(),
      getCodebaseContextModel(),
      getDivergenceRecordModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getSessionModel().deleteMany({});
    await getAuditLogModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
    await getDivergenceRecordModel().deleteMany({});
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

  async function seedIntentAndContext(userId: string, ticketKey: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey,
      problemStatement: sampleNamingConflictTicketIntent.problemStatement,
      proposedApproach: sampleNamingConflictTicketIntent.proposedApproach,
      acceptanceCriteria: sampleNamingConflictTicketIntent.acceptanceCriteria,
      affectedComponents: sampleNamingConflictTicketIntent.affectedComponents,
      dependencies: sampleNamingConflictTicketIntent.dependencies,
      constraints: sampleNamingConflictTicketIntent.constraints,
      metadata: sampleNamingConflictTicketIntent.metadata,
      gaps: [],
      canProceedToAnalysis: true,
      createdBy: userId,
      updatedBy: userId,
    });

    const context = await getCodebaseContextModel().create({
      userId,
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      treeFingerprint: 'abc123',
      context: {
        ...sampleAutoDevLikeContext,
        fileStructureMap: [],
        dependencyGraph: [],
      },
      expiresAt: buildAnalysisExpiryDate(),
      createdBy: userId,
      updatedBy: userId,
    });

    return { intent, context };
  }

  it('detects divergences and persists results linked to ticket intent', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    expect(user).not.toBeNull();

    await seedIntentAndContext(String(user!._id), 'OPL-3002');

    const response = await request(app)
      .post('/api/v1/tickets/OPL-3002/divergence')
      .set('Cookie', sessionCookie)
      .send({
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        workflowId: 'workflow-div-001',
      });

    expect(response.status).toBe(200);
    expect(response.body.aligned).toBe(false);
    expect(response.body.divergences.length).toBeGreaterThan(0);
    expect(response.body.ticketIntentId).toBeTruthy();
    expect(response.body.codebaseContextId).toBeTruthy();

    const persisted = await getDivergenceRecordModel().findById(response.body.persistedId).exec();
    expect(persisted?.ticketIntentId).toBe(response.body.ticketIntentId);

    const intent = await getTicketIntentModel().findById(response.body.ticketIntentId).exec();
    expect(intent?.latestDivergenceRecordId).toBe(response.body.persistedId);

    const events = eventBus.getHistory().filter((event) => event.type === 'DIVERGENCE_DETECTED');
    expect(events.length).toBe(response.body.divergences.length);
  });

  it('emits DIVERGENCE_NONE when ticket aligns with codebase context', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();

    await getTicketIntentModel().create({
      userId: String(user!._id),
      ticketKey: 'OPL-3001',
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach:
        'Add a userService in packages/backend/src/services with camelCase naming and route handlers in packages/backend/src/routes.',
      acceptanceCriteria: sampleTicketIntent.acceptanceCriteria,
      affectedComponents: ['services', 'routes'],
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: [],
      canProceedToAnalysis: true,
      createdBy: String(user!._id),
      updatedBy: String(user!._id),
    });

    await getCodebaseContextModel().create({
      userId: String(user!._id),
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      branch: 'main',
      treeFingerprint: 'abc123',
      context: {
        ...sampleAutoDevLikeContext,
        fileStructureMap: [],
        dependencyGraph: [],
      },
      expiresAt: buildAnalysisExpiryDate(),
      createdBy: String(user!._id),
      updatedBy: String(user!._id),
    });

    const response = await request(app)
      .post('/api/v1/tickets/OPL-3001/divergence')
      .set('Cookie', sessionCookie)
      .send({
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        workflowId: 'workflow-div-002',
      });

    expect(response.status).toBe(200);
    expect(response.body.aligned).toBe(true);
    expect(response.body.divergences).toEqual([]);
    expect(eventBus.getHistory().some((event) => event.type === 'DIVERGENCE_NONE')).toBe(true);
  });

  it('returns 412 when ticket intent is missing', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/tickets/OPL-9999/divergence')
      .set('Cookie', sessionCookie)
      .send({
        owner: 'santosh-opsera',
        repo: 'auto-dev',
        workflowId: 'workflow-div-003',
      });

    expect(response.status).toBe(412);
  });
});
