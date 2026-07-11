import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../index.js';
import { validConventionSettingsInput } from '../fixtures/conventions.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getConventionSettingsModel } from '../models/conventionSettingsModel.js';
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
    login,
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
  };
}

describe('convention routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getConventionSettingsModel(),
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
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
    await getConventionSettingsModel().deleteMany({});
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

  it('returns read-only defaults without persisting them', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .get('/api/v1/conventions/defaults')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    expect(response.body.templates.commitMessageFormat).toContain('{ticketKey}');
    expect(response.body.availableVariables).toContain('summary');

    const count = await getConventionSettingsModel().countDocuments({});
    expect(count).toBe(0);
  });

  it('creates initial convention settings and returns active version', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const create = await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    expect(create.status).toBe(201);
    expect(create.body.version).toBe(1);
    expect(create.body.isActive).toBe(true);

    const active = await request(app)
      .get('/api/v1/conventions')
      .set('Cookie', sessionCookie);

    expect(active.status).toBe(200);
    expect(active.body.settings.id).toBe(create.body.id);
  });

  it('returns field-level validation errors with examples', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const response = await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send({
        ...validConventionSettingsInput,
        commitMessageFormat: '',
        branchNamingPattern: '[invalid',
        reviewerAssignmentRules: {
          mode: 'manual-list',
          reviewers: ['not valid!'],
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'commitMessageFormat' }),
        expect.objectContaining({ path: 'branchNamingPattern' }),
        expect.objectContaining({ path: 'reviewerAssignmentRules.reviewers.0' }),
      ]),
    );
  });

  it('creates a new version via PUT without mutating the previous document', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const create = await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    const updatedInput = {
      ...validConventionSettingsInput,
      commitMessageFormat: '{type}: {description} [{ticketKey}]',
    };

    const update = await request(app)
      .put(`/api/v1/conventions/${create.body.id}`)
      .set('Cookie', sessionCookie)
      .send(updatedInput);

    expect(update.status).toBe(200);
    expect(update.body.version).toBe(2);
    expect(update.body.previousVersionId).toBe(create.body.id);

    const previous = await getConventionSettingsModel().findById(create.body.id).exec();
    expect(previous?.isActive).toBe(false);
    expect(previous?.commitMessageFormat).toBe(validConventionSettingsInput.commitMessageFormat);

    const history = await request(app)
      .get('/api/v1/conventions/history')
      .set('Cookie', sessionCookie);

    expect(history.status).toBe(200);
    expect(history.body.versions).toHaveLength(2);
    expect(history.body.versions[0].version).toBe(2);
  });

  it('records audit events for create and update', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const create = await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    await request(app)
      .put(`/api/v1/conventions/${create.body.id}`)
      .set('Cookie', sessionCookie)
      .send({
        ...validConventionSettingsInput,
        prTitleTemplate: '[{ticketKey}] Updated',
      });

    const auditRecords = await getAuditLogModel()
      .find({ resource: { $regex: '^convention_settings/' } })
      .sort({ createdAt: 1 })
      .exec();

    expect(auditRecords).toHaveLength(2);
    expect(auditRecords[0]?.operation).toBe('create');
    expect(auditRecords[1]?.operation).toBe('update');
    expect(auditRecords[1]?.previousValue).toMatchObject({
      version: 1,
    });
  });

  it('blocks workflow start when convention settings are missing', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    const blocked = await request(app)
      .post('/api/v1/test/workflow/start')
      .set('Cookie', sessionCookie);

    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe(
      'Convention settings must be configured before starting development.',
    );
  });

  it('allows workflow start after convention settings exist', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);

    await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    const allowed = await request(app)
      .post('/api/v1/test/workflow/start')
      .set('Cookie', sessionCookie);

    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
  });
});
