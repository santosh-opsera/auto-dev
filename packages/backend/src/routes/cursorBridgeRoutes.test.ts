import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import {
  sampleApprovedPrd,
  sampleAutoDevLikeContext,
  sampleCursorConventions,
  samplePrdSections,
  sampleTicketIntent,
} from '@autodev/shared-types';
import { createApp } from '../index.js';
import { mockGitHubTokenResponse, mockGitHubUserResponse } from '../fixtures/auth.js';
import { sampleUserDocuments, seedDocuments } from '../fixtures/database.js';
import { resetAuthRateLimits } from '../middleware/appRateLimits.js';
import { resetLockouts } from '../auth/lockoutService.js';
import { getAuditLogModel } from '../models/auditLogModel.js';
import { getCodebaseContextModel } from '../models/codebaseContextModel.js';
import { getConventionSettingsModel } from '../models/conventionSettingsModel.js';
import { getImplementationChunkModel } from '../models/implementationChunkModel.js';
import { getPrdModel } from '../models/prdModel.js';
import { getSessionModel } from '../models/sessionModel.js';
import { getTicketIntentModel } from '../models/ticketIntentModel.js';
import { getUserModel } from '../models/userModel.js';
import { getWorkflowModel } from '../models/workflowModel.js';
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

describe('cursor bridge chunk routes', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getSessionModel(),
      getAuditLogModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getTicketIntentModel(),
      getCodebaseContextModel(),
      getConventionSettingsModel(),
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
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getTicketIntentModel().deleteMany({});
    await getCodebaseContextModel().deleteMany({});
    await getConventionSettingsModel().deleteMany({});
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

  async function seedReadyChunk(userId: string) {
    const intent = await getTicketIntentModel().create({
      userId,
      ticketKey: sampleTicketIntent.ticketKey,
      problemStatement: sampleTicketIntent.problemStatement,
      proposedApproach: sampleTicketIntent.proposedApproach,
      acceptanceCriteria: sampleTicketIntent.acceptanceCriteria,
      affectedComponents: sampleTicketIntent.affectedComponents,
      dependencies: sampleTicketIntent.dependencies,
      constraints: sampleTicketIntent.constraints,
      metadata: sampleTicketIntent.metadata,
      gaps: [],
      canProceedToAnalysis: true,
      createdBy: userId,
      updatedBy: userId,
    });

    await getCodebaseContextModel().create({
      userId,
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
      branch: sampleAutoDevLikeContext.branch,
      treeFingerprint: 'fp-cursor-route-001',
      context: { ...sampleAutoDevLikeContext },
      expiresAt: new Date(Date.now() + 86_400_000),
      createdBy: userId,
      updatedBy: userId,
    });

    await getConventionSettingsModel().create({
      userId,
      version: 1,
      isActive: true,
      ...sampleCursorConventions,
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-cursor-route-001',
      ticketKey: sampleTicketIntent.ticketKey,
      state: 'APPROVED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: sampleTicketIntent.ticketKey,
      ticketIntentId: intent._id.toString(),
      workflowId: workflow.workflowId,
      owner: sampleAutoDevLikeContext.owner,
      repo: sampleAutoDevLikeContext.repo,
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      approvedBy: 'Alex Developer',
      approvedAt: new Date('2026-07-13T12:00:00.000Z'),
      createdBy: userId,
      updatedBy: userId,
    });

    const chunk = await getImplementationChunkModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Cursor bridge chunk',
      description: 'Implement cursor bridge packaging and delivery',
      scope: {
        files: [
          'packages/backend/src/services/cursor/cursorBridgeService.ts',
          'packages/shared-types/src/cursorBridge.ts',
        ],
        modules: ['backend/services/cursor', 'shared-types'],
      },
      dependencies: [],
      estimatedComplexity: 'high',
      status: 'PENDING',
      createdBy: userId,
      updatedBy: userId,
      dataClassification: 'internal',
    });

    return { workflow, chunk };
  }

  it('exposes context, execute (mock Cursor), and results endpoints', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsUser(app);
    const user = await getUserModel().findOne({ email: 'alex.dev@example.com' }).exec();
    const { workflow, chunk } = await seedReadyChunk(String(user!._id));
    const base = `/api/v1/workflows/${workflow._id.toString()}/chunks/${chunk._id.toString()}`;

    const contextResponse = await request(app).get(`${base}/context`).set('Cookie', sessionCookie);
    expect(contextResponse.status).toBe(200);
    expect(contextResponse.body.context.schemaVersion).toBe('1');
    expect(contextResponse.body.context.guidance.filesToModify).toHaveLength(2);

    const dryRun = await request(app)
      .post(`${base}/execute`)
      .set('Cookie', sessionCookie)
      .send({ dryRun: true });
    expect(dryRun.status).toBe(200);
    expect(dryRun.body.delivery.status).toBe('dry_run');

    const execute = await request(app).post(`${base}/execute`).set('Cookie', sessionCookie).send({});
    expect(execute.status).toBe(200);
    expect(execute.body.delivery.status).toBe('delivered');
    expect(execute.body.validation.scope.valid).toBe(true);
    expect(execute.body.validation.conventions.valid).toBe(true);

    const results = await request(app)
      .post(`${base}/results`)
      .set('Cookie', sessionCookie)
      .send({
        chunkId: chunk._id.toString(),
        workflowId: workflow.workflowId,
        branchName: 'feature/OPL-1234',
        commitMessage: 'OPL-1234: Cursor bridge results',
        fileChanges: chunk.scope.files.map((path: string) => ({
          path,
          action: 'modified',
        })),
        newFiles: [],
        deletedFiles: [],
        summary: 'webhook result',
      });

    expect(results.status).toBe(200);
    expect(results.body.validation.scope.valid).toBe(true);
    expect(results.body.validation.conventions.valid).toBe(true);
  });
});
