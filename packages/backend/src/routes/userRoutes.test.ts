import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  dataExportResponseSchema,
  ERASURE_GRACE_PERIOD_MS,
  erasureScheduleResponseSchema,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { validConventionSettingsInput } from '../fixtures/conventions.js';
import { sampleCrossCollectionUserData } from '../fixtures/gdprDsr.js';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../fixtures/auth.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { encryptSecret } from '../lib/encryption.js';
import { getAiInteractionLogModel, buildAiInteractionExpiryDate } from '../models/aiInteractionLogModel.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getConventionSettingsModel } from '../models/conventionSettingsModel.js';
import { getDataErasureRequestModel } from '../models/dataErasureRequestModel.js';
import { getRepositoryConnectionModel } from '../models/repositoryConnectionModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowModel } from '../models/workflowModel.js';
import { ensureIndexes } from '../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../testHelpers/memoryServer.js';
import { encryptWithPerRecordDek } from '../lib/encryption.js';
import { DataSubjectRightsService } from '../services/gdpr/dataSubjectRightsService.js';
import { auditService } from '../services/audit/auditService.js';

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

  const email =
    (login.body as { user?: { email?: string } }).user?.email ?? 'alex.dev@example.com';
  const user = await getUserModel().findOne({ email }).exec();

  return {
    login,
    sessionCookie: sessionCookie ? [sessionCookie.split(';')[0] ?? ''] : [],
    userId: user ? String(user._id) : undefined,
  };
}

describe('GDPR data subject rights API (integration)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getConventionSettingsModel(),
      getWorkflowModel(),
      getRepositoryConnectionModel(),
      getDataErasureRequestModel(),
      getAiInteractionLogModel(),
      getAuditLogModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await resetAuthRateLimits();
    await resetLockouts();
    await Promise.all([
      getUserModel().deleteMany({}),
      getSessionModel().deleteMany({}),
      getConventionSettingsModel().deleteMany({}),
      getWorkflowModel().deleteMany({}),
      getRepositoryConnectionModel().deleteMany({}),
      getDataErasureRequestModel().deleteMany({}),
      getAiInteractionLogModel().deleteMany({}),
      getAuditLogModel().collection.deleteMany({}),
    ]);

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

  it('exports profile, conventions, workflows, audit logs, and connected repos as JSON', async () => {
    const app = createApp();
    const { sessionCookie, userId } = await loginAsUser(app);
    expect(userId).toBeTruthy();

    await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    await getWorkflowModel().create({
      userId: userId!,
      workflowId: sampleCrossCollectionUserData.workflow.workflowId,
      ticketKey: sampleCrossCollectionUserData.workflow.ticketKey,
      state: 'CREATED',
      history: [],
      dataClassification: 'internal',
      createdBy: userId!,
      updatedBy: userId!,
    });

    await getRepositoryConnectionModel().create({
      userId: userId!,
      ...sampleCrossCollectionUserData.repository,
      connectedAt: new Date('2026-06-10T08:00:00.000Z'),
      dataClassification: 'internal',
      createdBy: userId!,
      updatedBy: userId!,
    });

    await auditService.log({
      resource: sampleCrossCollectionUserData.audit.resource,
      operation: sampleCrossCollectionUserData.audit.operation,
      actor: userId!,
      correlationId: sampleCrossCollectionUserData.audit.correlationId,
    });

    const response = await request(app)
      .get('/api/v1/user/data-export')
      .set('Cookie', sessionCookie);

    expect(response.status).toBe(200);
    const parsed = dataExportResponseSchema.safeParse(response.body);
    expect(parsed.success).toBe(true);
    expect(response.body.profile.email).toBe('alex.dev@example.com');
    expect(response.body.conventionSettings.length).toBeGreaterThanOrEqual(1);
    expect(response.body.workflowHistory.some((w: { ticketKey: string }) => w.ticketKey === 'AUTO-100')).toBe(
      true,
    );
    expect(response.body.connectedRepositories[0]?.fullName).toBe('acme/auto-dev');
    expect(response.body.auditLogs.some((a: { actor: string }) => a.actor === userId)).toBe(true);

    const exportAudits = await getAuditLogModel().find({ resource: `user/${userId}/data-export` });
    expect(exportAudits.length).toBeGreaterThanOrEqual(1);
  });

  it('updates display name and email with validation', async () => {
    const app = createApp();
    const { sessionCookie, userId } = await loginAsUser(app);

    const invalid = await request(app)
      .put('/api/v1/user/profile')
      .set('Cookie', sessionCookie)
      .send({ displayName: '', email: 'not-email' });
    expect(invalid.status).toBe(400);

    const updated = await request(app)
      .put('/api/v1/user/profile')
      .set('Cookie', sessionCookie)
      .send({ displayName: 'Alex Updated', email: 'alex.updated@example.com' });

    expect(updated.status).toBe(200);
    expect(updated.body.profile.displayName).toBe('Alex Updated');
    expect(updated.body.profile.email).toBe('alex.updated@example.com');

    const user = await getUserModel().findById(userId);
    expect(user?.email).toBe('alex.updated@example.com');

    const audits = await getAuditLogModel().find({ resource: `user/${userId}/profile` });
    expect(audits.length).toBeGreaterThanOrEqual(1);
  });

  it('schedules erasure with email confirmation, allows cancel in grace period, and blocks after', async () => {
    let now = new Date('2026-07-13T12:00:00.000Z');
    const clock = () => now;
    const service = new DataSubjectRightsService({ clock });
    const app = createApp();
    // Mount is global; exercise service clock via direct calls for grace timing,
    // and HTTP for schedule/cancel happy path.
    const { sessionCookie, userId } = await loginAsUser(app);
    const email = 'alex.dev@example.com';

    const wrongEmail = await request(app)
      .delete('/api/v1/user/data')
      .set('Cookie', sessionCookie)
      .send({ confirmationEmail: 'wrong@example.com' });
    expect(wrongEmail.status).toBe(400);

    const scheduled = await request(app)
      .delete('/api/v1/user/data')
      .set('Cookie', sessionCookie)
      .send({ confirmationEmail: email });
    expect(scheduled.status).toBe(202);
    expect(erasureScheduleResponseSchema.safeParse(scheduled.body).success).toBe(true);
    expect(scheduled.body.gracePeriodMs).toBe(ERASURE_GRACE_PERIOD_MS);

    const cancelled = await request(app)
      .post('/api/v1/user/data/cancel-erasure')
      .set('Cookie', sessionCookie);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.status).toBe('cancelled');

    const user = await getUserModel().findById(userId).exec();
    expect(user).not.toBeNull();

    // Re-schedule via injectable clock service and verify cancel is rejected after grace.
    await service.scheduleErasure(user!, { confirmationEmail: email }, userId!);
    now = new Date(now.getTime() + ERASURE_GRACE_PERIOD_MS + 1);
    await expect(service.cancelErasure(user!, userId!)).rejects.toMatchObject({
      statusCode: 409,
    });
  });

  it('executes full erasure lifecycle: crypto-erase secrets, purge collections, keep system audit', async () => {
    let now = new Date('2026-07-13T12:00:00.000Z');
    const clock = () => now;
    const service = new DataSubjectRightsService({ clock });
    const app = createApp();
    const { sessionCookie, userId } = await loginAsUser(app);

    await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(validConventionSettingsInput);

    await getWorkflowModel().create({
      userId: userId!,
      workflowId: 'wf-erase-1',
      ticketKey: 'AUTO-200',
      state: 'CREATED',
      history: [],
      dataClassification: 'internal',
      createdBy: userId!,
      updatedBy: userId!,
    });

    await getRepositoryConnectionModel().create({
      userId: userId!,
      owner: 'acme',
      repo: 'widgets',
      fullName: 'acme/widgets',
      defaultBranch: 'main',
      connectedAt: new Date(),
      dataClassification: 'internal',
      createdBy: userId!,
      updatedBy: userId!,
    });

    const wrapped = encryptWithPerRecordDek(JSON.stringify({ prompt: 'secret PII' }));
    await getAiInteractionLogModel().create({
      userId: userId!,
      provider: 'openai',
      model: 'gpt-4o-mini',
      promptHash: 'hash-erase',
      encryptedPayload: JSON.stringify(wrapped),
      dataClassification: 'confidential',
      createdBy: userId!,
      updatedBy: userId!,
      expiresAt: buildAiInteractionExpiryDate(now.getTime()),
    });

    await auditService.log({
      resource: 'user/pre-erasure',
      operation: 'create',
      actor: userId!,
      correlationId: 'pre-erasure-corr',
    });

    // Ensure OAuth tokens are present (login already encrypted them).
    const before = await getUserModel().findById(userId).exec();
    expect(before?.github?.encryptedAccessToken).toBeTruthy();
    expect(before?.github?.encryptedAccessToken).not.toBe(encryptSecret('x'));

    await service.scheduleErasure(
      before!,
      { confirmationEmail: before!.email },
      userId!,
    );

    now = new Date(now.getTime() + ERASURE_GRACE_PERIOD_MS);
    const summaries = await service.processDueErasureRequests();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]?.cryptographicallyErased.oauthTokenFields).toBeGreaterThanOrEqual(1);
    expect(summaries[0]?.purged.userRecord).toBe(1);

    expect(await getUserModel().findById(userId).exec()).toBeNull();
    expect(await getConventionSettingsModel().countDocuments({ userId })).toBe(0);
    expect(await getWorkflowModel().countDocuments({ userId })).toBe(0);
    expect(await getRepositoryConnectionModel().countDocuments({ userId })).toBe(0);
    expect(await getAiInteractionLogModel().countDocuments({ userId })).toBe(0);
    expect(await getSessionModel().countDocuments({ userId })).toBe(0);
    expect(await getAuditLogModel().countDocuments({ actor: userId })).toBe(0);

    const systemProof = await getAuditLogModel()
      .find({ actor: 'system', resource: `user/${userId}/data-erasure` })
      .exec();
    expect(systemProof.length).toBeGreaterThanOrEqual(1);

    const erasureRequest = await getDataErasureRequestModel()
      .findOne({ userId, status: 'executed' })
      .exec();
    expect(erasureRequest).not.toBeNull();
  });

  it('requires authentication for all DSR endpoints', async () => {
    const app = createApp();
    expect((await request(app).get('/api/v1/user/data-export')).status).toBe(401);
    expect(
      (await request(app).put('/api/v1/user/profile').send({ displayName: 'A', email: 'a@b.com' }))
        .status,
    ).toBe(401);
    expect(
      (await request(app).delete('/api/v1/user/data').send({ confirmationEmail: 'a@b.com' })).status,
    ).toBe(401);
    expect((await request(app).post('/api/v1/user/data/cancel-erasure')).status).toBe(401);
  });
});
