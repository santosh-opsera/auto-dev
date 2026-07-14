import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockGitHubPullRequestResponse,
  sampleApprovedPrd,
  samplePrCreationConventions,
  samplePrdSections,
} from '@autodev/shared-types';
import { encryptSecret } from '@autodev/infrastructure';
import { getConventionSettingsModel } from '../../models/conventionSettingsModel.js';
import { getImplementationChunkModel } from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getRepositoryConnectionModel } from '../../models/repositoryConnectionModel.js';
import { getUserModel } from '../../models/userModel.js';
import { getWorkflowModel } from '../../models/workflowModel.js';
import { sampleUserDocuments, seedDocuments } from '../../fixtures/database.js';
import { ensureIndexes } from '../../database/indexes.js';
import { startMemoryMongo, stopMemoryMongo } from '../../testHelpers/memoryServer.js';
import { eventBus } from '@autodev/infrastructure';
import * as githubApiClientModule from './githubApiClient.js';
import { PrCreationService } from './prCreationService.js';

describe('PrCreationService', () => {
  beforeAll(async () => {
    await startMemoryMongo();
    await ensureIndexes([
      getUserModel(),
      getWorkflowModel(),
      getPrdModel(),
      getImplementationChunkModel(),
      getConventionSettingsModel(),
      getRepositoryConnectionModel(),
    ]);
  }, 60_000);

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    eventBus.clearHistory();
    await getUserModel().deleteMany({});
    await getWorkflowModel().deleteMany({});
    await getPrdModel().deleteMany({});
    await getImplementationChunkModel().deleteMany({});
    await getConventionSettingsModel().deleteMany({});
    await getRepositoryConnectionModel().deleteMany({});
    await seedDocuments(getUserModel(), sampleUserDocuments);
    vi.restoreAllMocks();
  });

  async function seedReadyWorkflow(userId: string, reviewerMode: 'manual-list' | 'round-robin' = 'manual-list') {
    const workflow = await getWorkflowModel().create({
      userId,
      workflowId: 'wf-pr-001',
      ticketKey: 'OPL-1234',
      state: 'TEST_PASSED',
      history: [],
      createdBy: userId,
      updatedBy: userId,
    });

    const prd = await getPrdModel().create({
      userId,
      ticketKey: 'OPL-1234',
      ticketIntentId: 'intent-pr-1',
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      version: 1,
      status: 'approved',
      isActive: true,
      sections: samplePrdSections,
      codebaseContext: sampleApprovedPrd.codebaseContext,
      createdBy: userId,
      updatedBy: userId,
    });

    await getConventionSettingsModel().create({
      userId,
      version: 1,
      isActive: true,
      ...samplePrCreationConventions,
      reviewerAssignmentRules:
        reviewerMode === 'round-robin'
          ? { mode: 'round-robin', reviewers: ['alice', 'bob'] }
          : samplePrCreationConventions.reviewerAssignmentRules,
      roundRobinCursor: 0,
      createdBy: userId,
      updatedBy: userId,
    });

    await getRepositoryConnectionModel().create({
      userId,
      owner: 'santosh-opsera',
      repo: 'auto-dev',
      fullName: 'santosh-opsera/auto-dev',
      defaultBranch: 'main',
      connectedAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });

    await getImplementationChunkModel().create({
      userId,
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      prdId: prd._id.toString(),
      order: 0,
      name: 'Add user auth',
      description: 'Implement authentication helpers',
      scope: {
        files: ['packages/backend/src/services/github/prCreationService.ts'],
        modules: ['backend/services/github'],
      },
      dependencies: [],
      estimatedComplexity: 'medium',
      status: 'COMPLETED',
      branchName: 'feature/OPL-1234-add-user-auth',
      gitStatus: 'ready_for_pr',
      createdBy: userId,
      updatedBy: userId,
    });

    const user = await getUserModel().findById(userId).exec();
    user!.github = {
      providerUserId: '1',
      encryptedAccessToken: encryptSecret('gh-token'),
      scopes: ['repo', 'read:user', 'user:email'],
    };
    await user!.save();

    return { workflow, user: user! };
  }

  it('creates a PR using convention templates, labels, reviewers, and emits PR_CREATED', async () => {
    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const userId = String(loaded!._id);
    const { workflow, user } = await seedReadyWorkflow(userId);

    const createPullRequest = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createPullRequest')
      .mockResolvedValue({
        number: mockGitHubPullRequestResponse.number,
        htmlUrl: mockGitHubPullRequestResponse.html_url,
        title: mockGitHubPullRequestResponse.title,
        body: mockGitHubPullRequestResponse.body,
        headBranch: mockGitHubPullRequestResponse.head.ref,
        baseBranch: mockGitHubPullRequestResponse.base.ref,
        state: mockGitHubPullRequestResponse.state,
      });
    const requestReviewers = vi
      .spyOn(githubApiClientModule.githubApiClient, 'requestPullRequestReviewers')
      .mockResolvedValue(undefined);
    const addLabels = vi
      .spyOn(githubApiClientModule.githubApiClient, 'addPullRequestLabels')
      .mockResolvedValue(undefined);

    const service = new PrCreationService(githubApiClientModule.githubApiClient);
    const result = await service.createPullRequest(user, workflow._id.toString(), {
      changeType: 'feature',
    });

    expect(createPullRequest).toHaveBeenCalledWith(
      expect.any(String),
      'santosh-opsera',
      'auto-dev',
      expect.objectContaining({
        title: expect.stringContaining('OPL-1234'),
        head: 'feature/OPL-1234-add-user-auth',
        base: 'main',
      }),
    );
    const createArgs = createPullRequest.mock.calls[0]![3]!;
    expect(createArgs.body).toContain('## Summary');
    expect(createArgs.body).toContain('/browse/OPL-1234');
    expect(createArgs.body).toContain('## Test Results');
    expect(createArgs.body).toContain('## Analysis Notes');

    expect(requestReviewers).toHaveBeenCalledWith(
      expect.any(String),
      'santosh-opsera',
      'auto-dev',
      42,
      ['octocat', 'hubot'],
    );
    expect(addLabels).toHaveBeenCalledWith(
      expect.any(String),
      'santosh-opsera',
      'auto-dev',
      42,
      ['feature'],
    );

    expect(result.prUrl).toBe(mockGitHubPullRequestResponse.html_url);
    expect(result.labels).toEqual(['feature']);
    expect(result.created).toBe(true);

    const refreshed = await getWorkflowModel().findById(workflow._id).exec();
    expect(refreshed?.state).toBe('PR_CREATED');
    expect(refreshed?.prUrl).toBe(mockGitHubPullRequestResponse.html_url);
    expect(refreshed?.pullRequest?.number).toBe(42);

    expect(eventBus.getHistory().some((event) => event.type === 'PR_CREATED')).toBe(true);

    const stored = await service.getPullRequest(user, workflow._id.toString());
    expect(stored.prUrl).toBe(result.prUrl);
    expect(stored.created).toBe(false);
  });

  it('rotates round-robin reviewers across creations', async () => {
    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const userId = String(loaded!._id);
    const { workflow, user } = await seedReadyWorkflow(userId, 'round-robin');

    vi.spyOn(githubApiClientModule.githubApiClient, 'createPullRequest').mockResolvedValue({
      number: 1,
      htmlUrl: 'https://github.com/santosh-opsera/auto-dev/pull/1',
      title: 'title',
      body: 'body',
      headBranch: 'feature/OPL-1234-add-user-auth',
      baseBranch: 'main',
      state: 'open',
    });
    const requestReviewers = vi
      .spyOn(githubApiClientModule.githubApiClient, 'requestPullRequestReviewers')
      .mockResolvedValue(undefined);
    vi.spyOn(githubApiClientModule.githubApiClient, 'addPullRequestLabels').mockResolvedValue(
      undefined,
    );

    const service = new PrCreationService(githubApiClientModule.githubApiClient);
    await service.createPullRequest(user, workflow._id.toString(), {});

    expect(requestReviewers.mock.calls[0]?.[4]).toEqual(['alice']);

    const conventions = await getConventionSettingsModel()
      .findOne({ userId, isActive: true })
      .exec();
    expect(conventions?.roundRobinCursor).toBe(1);
  });

  it('retries on GitHub rate limit errors', async () => {
    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const userId = String(loaded!._id);
    const { workflow, user } = await seedReadyWorkflow(userId);
    const { AppError } = await import('../../utils/errors.js');

    const createPullRequest = vi
      .spyOn(githubApiClientModule.githubApiClient, 'createPullRequest')
      .mockRejectedValueOnce(
        new AppError('GitHubRateLimited', 'rate limited', 429, 'Wait and retry.'),
      )
      .mockResolvedValueOnce({
        number: 7,
        htmlUrl: 'https://github.com/santosh-opsera/auto-dev/pull/7',
        title: 'title',
        body: 'body',
        headBranch: 'feature/OPL-1234-add-user-auth',
        baseBranch: 'main',
        state: 'open',
      });
    vi.spyOn(githubApiClientModule.githubApiClient, 'requestPullRequestReviewers').mockResolvedValue(
      undefined,
    );
    vi.spyOn(githubApiClientModule.githubApiClient, 'addPullRequestLabels').mockResolvedValue(
      undefined,
    );

    const service = new PrCreationService(githubApiClientModule.githubApiClient);
    const result = await service.createPullRequest(user, workflow._id.toString(), {});

    expect(createPullRequest).toHaveBeenCalledTimes(2);
    expect(result.prNumber).toBe(7);
  });

  it('returns actionable errors when workflow is not ready', async () => {
    const loaded = await getUserModel().findOne({ email: sampleUserDocuments[0]!.email }).exec();
    const userId = String(loaded!._id);
    const { workflow, user } = await seedReadyWorkflow(userId);
    workflow.state = 'IMPLEMENTING';
    await workflow.save();

    const service = new PrCreationService(githubApiClientModule.githubApiClient);
    await expect(service.createPullRequest(user, workflow._id.toString(), {})).rejects.toMatchObject(
      {
        error: 'WorkflowNotReadyForPr',
        statusCode: 409,
      },
    );
  });
});
