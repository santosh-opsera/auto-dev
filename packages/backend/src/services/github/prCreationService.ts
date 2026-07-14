import { randomUUID } from 'node:crypto';
import type {
  CreatePullRequestRequest,
  GitHubRateLimitStatus,
  PrChangeType,
  PullRequestResponse,
  ReviewerAssignmentRules,
} from '@autodev/shared-types';
import { labelForChangeType } from '@autodev/shared-types';
import { decryptSecret } from '../../lib/encryption.js';
import { isRetryableHttpStatus } from '../../lib/retry.js';
import type { UserDocument } from '../../models/userModel.js';
import {
  getConventionSettingsModel,
} from '../../models/conventionSettingsModel.js';
import { getImplementationChunkModel } from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getCodebaseContextModel } from '../../models/codebaseContextModel.js';
import { getChunkTestReportModel } from '../../models/chunkTestReportModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { eventBus } from '@autodev/infrastructure';
import { conventionService } from '../conventions/conventionService.js';
import { userHasGitHubRepoScopes } from './githubScopes.js';
import { GitHubApiClient, githubApiClient } from './githubApiClient.js';
import { repositoryService } from './repositoryService.js';
import {
  buildJiraTicketUrl,
  CODEOWNERS_CANDIDATE_PATHS,
  inferChangeTypeFromBranch,
  parseCodeOwners,
  resolvePrDescription,
  resolvePrTitle,
  selectReviewersFromRules,
} from './prHelpers.js';

const RATE_LIMIT_WARN_THRESHOLD = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function withGitHubRetry<T>(
  operation: () => Promise<T>,
  delaysMs: readonly number[] = process.env.NODE_ENV === 'test' ? [0, 0] : [1000, 2000, 4000],
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const statusCode = error instanceof AppError ? error.statusCode : 0;
      if (!isRetryableHttpStatus(statusCode) || attempt >= delaysMs.length) {
        throw error;
      }
      await sleep(delaysMs[attempt] ?? 0);
    }
  }

  throw lastError;
}

function resolveGitHubAccessToken(user: UserDocument): string {
  const github = user.github;

  if (!github?.encryptedAccessToken) {
    throw new AppError(
      'GitHubNotConnected',
      'GitHub has not been linked to this account.',
      412,
      'Connect GitHub repository access from the repositories page, then retry.',
    );
  }

  if (!userHasGitHubRepoScopes(user)) {
    throw new AppError(
      'GitHubRepoAccessRequired',
      'GitHub repository access has not been granted for this account.',
      412,
      'Grant GitHub repository permissions from the repositories page, then retry.',
    );
  }

  return decryptSecret(github.encryptedAccessToken);
}

function toRateLimitStatus(snapshot: {
  limit: number;
  remaining: number;
  resetAt: number;
  queuedRequests: number;
}): GitHubRateLimitStatus {
  return {
    limit: snapshot.limit,
    remaining: snapshot.remaining,
    resetAt: new Date(snapshot.resetAt || Date.now()).toISOString(),
    queuedRequests: snapshot.queuedRequests,
  };
}

function formatAnalysisNotes(context: {
  designPatterns?: Array<{ pattern: string }>;
  namingConventions?: Array<{ category: string; confidence: number }>;
  architecturalLayers?: Array<{ layer: string }>;
  strategy?: string;
} | null): string {
  if (!context) {
    return 'No codebase analysis notes available.';
  }

  const parts: string[] = [];
  if (context.strategy) {
    parts.push(`Analysis strategy: ${context.strategy}`);
  }
  if (context.designPatterns && context.designPatterns.length > 0) {
    parts.push(
      `Patterns: ${context.designPatterns.map((pattern) => pattern.pattern).join(', ')}`,
    );
  }
  if (context.architecturalLayers && context.architecturalLayers.length > 0) {
    parts.push(
      `Layers: ${context.architecturalLayers.map((layer) => layer.layer).join(', ')}`,
    );
  }
  if (context.namingConventions && context.namingConventions.length > 0) {
    const highConfidence = context.namingConventions
      .filter((item) => item.confidence >= 0.7)
      .map((item) => item.category);
    if (highConfidence.length > 0) {
      parts.push(`Naming: ${highConfidence.join(', ')}`);
    }
  }

  return parts.length > 0 ? parts.join('; ') : 'Codebase analysis completed.';
}

function resolveSummary(
  prd: { sections?: { problemStatement?: string; solutionOutline?: string } } | null,
  chunks: Array<{ name: string }>,
  ticketKey: string,
): string {
  const problem = prd?.sections?.problemStatement?.trim();
  if (problem) {
    return problem.slice(0, 240);
  }
  const solution = prd?.sections?.solutionOutline?.trim();
  if (solution) {
    return solution.slice(0, 240);
  }
  return chunks[0]?.name || ticketKey;
}

function formatTestResults(
  reports: Array<{
    status: string;
    framework: string;
    finalTestResults?: { passedCount: number; failedCount: number };
    coverage?: { overallPercent: number };
  }>,
): string {
  if (reports.length === 0) {
    return 'No automated test reports available for this workflow.';
  }

  return reports
    .map((report) => {
      const passed = report.finalTestResults?.passedCount ?? 0;
      const failed = report.finalTestResults?.failedCount ?? 0;
      const coverage =
        report.coverage?.overallPercent !== undefined
          ? `; coverage ${String(report.coverage.overallPercent)}%`
          : '';
      return `${report.status}: ${String(passed)} passed, ${String(failed)} failed (${report.framework})${coverage}`;
    })
    .join('\n');
}

export class PrCreationService {
  constructor(private readonly client: GitHubApiClient = githubApiClient) {}

  async createPullRequest(
    user: UserDocument,
    workflowDocumentId: string,
    input: CreatePullRequestRequest = {},
  ): Promise<PullRequestResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    this.assertCanCreatePr(workflow);

    if (workflow.prUrl && workflow.state === 'PR_CREATED') {
      return this.getPullRequest(user, workflowDocumentId);
    }

    const conventions = await conventionService.getActive(String(user._id));
    if (!conventions) {
      throw new AppError(
        'ConventionsRequired',
        'Convention settings must be configured before creating a pull request.',
        409,
        'Create convention settings (PR title/description templates and reviewer rules) first.',
      );
    }

    const { owner, repo, connection, chunks, prd } = await this.loadRepoContext(
      user,
      workflow,
    );
    const accessToken = resolveGitHubAccessToken(user);
    const headBranch =
      input.headBranch?.trim() ||
      this.resolveHeadBranch(chunks) ||
      undefined;
    if (!headBranch) {
      throw new AppError(
        'HeadBranchRequired',
        'No head branch is available for pull request creation.',
        409,
        'Create and commit a chunk branch first, or pass headBranch in the request.',
      );
    }

    const baseBranch = input.baseBranch?.trim() || connection.defaultBranch || 'main';
    if (headBranch === baseBranch) {
      throw new AppError(
        'InvalidPullRequestBranches',
        'Head and base branches must differ.',
        400,
        'Provide a feature head branch that differs from the repository default branch.',
      );
    }

    const changeType: PrChangeType =
      input.changeType ?? inferChangeTypeFromBranch(headBranch);
    const label = labelForChangeType(changeType);

    const changedPaths = chunks.flatMap((chunk) => chunk.scope?.files ?? []);
    const reviewers = await this.resolveReviewers(
      user,
      accessToken,
      owner,
      repo,
      conventions.reviewerAssignmentRules,
      changedPaths,
    );

    const summary = resolveSummary(prd, chunks, workflow.ticketKey);
    const changes =
      changedPaths.length > 0
        ? changedPaths.map((path) => `- ${path}`).join('\n')
        : chunks.map((chunk) => `- ${chunk.name}`).join('\n') || 'See commits on the head branch.';

    const [codebaseRecord, testReports] = await Promise.all([
      getCodebaseContextModel().findOne({ userId: String(user._id), owner, repo }).exec(),
      getChunkTestReportModel()
        .find({ userId: String(user._id), workflowDocumentId: workflow._id.toString() })
        .exec(),
    ]);

    const analysisNotes = formatAnalysisNotes(codebaseRecord?.context ?? null);
    const jiraTicketUrl = buildJiraTicketUrl(workflow.ticketKey);
    const templateVariables: Record<string, string> = {
      ticketKey: workflow.ticketKey,
      summary,
      description: summary,
      context: analysisNotes,
      changes,
      type: changeType,
      jiraTicketUrl,
      testResults: formatTestResults(testReports),
      analysisNotes,
    };

    const title = resolvePrTitle(conventions.prTitleTemplate, templateVariables);
    const body = resolvePrDescription(conventions.prDescriptionTemplate, templateVariables);

    if (!title) {
      throw new AppError(
        'InvalidPrTitleTemplate',
        'Configured PR title template resolved to an empty string.',
        400,
        'Update convention PR title template to include variables such as {ticketKey} and {summary}.',
      );
    }

    if (workflow.state === 'TEST_PASSED') {
      await this.transitionWorkflow(user, workflow, 'PR_CREATING', 'pr.creating');
    }

    const rateLimiter = this.client.getRateLimiter();
    let rateLimitWarning: string | undefined;
    const preSnapshot = rateLimiter.getSnapshot();
    if (preSnapshot.remaining < RATE_LIMIT_WARN_THRESHOLD) {
      rateLimitWarning = `GitHub API rate limit is low (${String(preSnapshot.remaining)} remaining). Retrying if limited.`;
    }

    let pullRequest;
    try {
      pullRequest = await withGitHubRetry(() =>
        this.client.createPullRequest(accessToken, owner, repo, {
          title,
          head: headBranch,
          base: baseBranch,
          body,
        }),
      );
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError(
        'PullRequestCreationFailed',
        error instanceof Error ? error.message : 'Failed to create pull request on GitHub.',
        502,
        'Verify branch state and GitHub permissions, then retry.',
      );
    }

    try {
      await withGitHubRetry(() =>
        this.client.requestPullRequestReviewers(
          accessToken,
          owner,
          repo,
          pullRequest.number,
          reviewers,
        ),
      );
      await withGitHubRetry(() =>
        this.client.addPullRequestLabels(accessToken, owner, repo, pullRequest.number, [label]),
      );
    } catch (error) {
      workflow.prUrl = pullRequest.htmlUrl;
      workflow.pullRequest = {
        url: pullRequest.htmlUrl,
        number: pullRequest.number,
        title,
        body,
        reviewers,
        labels: [label],
        changeType,
        headBranch,
        baseBranch,
        owner,
        repo,
      };
      await workflow.save();
      if (error instanceof AppError) {
        throw new AppError(
          error.error,
          `Pull request was created at ${pullRequest.htmlUrl}, but follow-up failed: ${error.message}`,
          error.statusCode,
          error.suggestedAction,
        );
      }
      throw error;
    }

    workflow.prUrl = pullRequest.htmlUrl;
    workflow.pullRequest = {
      url: pullRequest.htmlUrl,
      number: pullRequest.number,
      title,
      body,
      reviewers,
      labels: [label],
      changeType,
      headBranch,
      baseBranch,
      owner,
      repo,
    };
    workflow.error = null;
    await workflow.save();

    await this.transitionWorkflow(user, workflow, 'PR_CREATED', 'pr.created');

    await eventBus.publish({
      type: 'PR_CREATED',
      payload: {
        workflowId: workflow.workflowId,
        prUrl: pullRequest.htmlUrl,
        prNumber: pullRequest.number,
        reviewers,
        title,
      },
      metadata: {
        eventId: randomUUID(),
        correlationId: workflow._id.toString(),
        actor: String(user._id),
        userId: String(user._id),
        timestamp: new Date().toISOString(),
      },
    });

    await auditService.logSafe({
      resource: `workflows/${workflow._id.toString()}/pull-request`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        prUrl: pullRequest.htmlUrl,
        prNumber: pullRequest.number,
        reviewers,
        labels: [label],
      },
    });

    const rateLimit = toRateLimitStatus(rateLimiter.getSnapshot());
    const response: PullRequestResponse = {
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      ticketKey: workflow.ticketKey,
      prNumber: pullRequest.number,
      prUrl: pullRequest.htmlUrl,
      title,
      body,
      labels: [label],
      reviewers,
      changeType,
      owner,
      repo,
      headBranch,
      baseBranch,
      created: true,
      rateLimit,
    };
    if (rateLimitWarning) {
      response.rateLimitWarning = rateLimitWarning;
    }
    return response;
  }

  async getPullRequest(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<PullRequestResponse> {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    if (!workflow.prUrl || !workflow.pullRequest) {
      throw new AppError(
        'PullRequestNotFound',
        'No pull request has been created for this workflow yet.',
        404,
        'Call POST /api/v1/workflows/:id/pull-request after tests pass.',
      );
    }

    const stored = workflow.pullRequest;
    return {
      workflowDocumentId: workflow._id.toString(),
      workflowId: workflow.workflowId,
      ticketKey: workflow.ticketKey,
      prNumber: stored.number,
      prUrl: stored.url,
      title: stored.title,
      body: stored.body,
      labels: [...stored.labels],
      reviewers: [...stored.reviewers],
      changeType: stored.changeType,
      owner: stored.owner,
      repo: stored.repo,
      headBranch: stored.headBranch,
      baseBranch: stored.baseBranch,
      created: false,
    };
  }

  private assertCanCreatePr(workflow: WorkflowRecord): void {
    if (workflow.state === 'PR_CREATED' && workflow.prUrl) {
      return;
    }

    if (workflow.state !== 'TEST_PASSED' && workflow.state !== 'PR_CREATING') {
      throw new AppError(
        'WorkflowNotReadyForPr',
        `Workflow must be in TEST_PASSED or PR_CREATING before creating a pull request (current: ${workflow.state}).`,
        409,
        'Complete testing successfully, then create the pull request.',
      );
    }
  }

  private async resolveReviewers(
    user: UserDocument,
    accessToken: string,
    owner: string,
    repo: string,
    rules: ReviewerAssignmentRules,
    changedPaths: string[],
  ): Promise<string[]> {
    if (rules.mode === 'code-owner-based') {
      const content = await this.loadCodeOwners(accessToken, owner, repo);
      if (!content) {
        throw new AppError(
          'CodeOwnersNotFound',
          'Reviewer mode is code-owner-based but no CODEOWNERS file was found in the repository.',
          409,
          'Add a CODEOWNERS file at CODEOWNERS, .github/CODEOWNERS, or docs/CODEOWNERS, or switch reviewer mode.',
        );
      }
      const owners = parseCodeOwners(content, changedPaths.length > 0 ? changedPaths : ['*']);
      if (owners.length === 0) {
        throw new AppError(
          'CodeOwnersEmpty',
          'CODEOWNERS file did not yield any reviewers for the changed paths.',
          409,
          'Update CODEOWNERS entries for the changed files, or switch to manual-list / round-robin.',
        );
      }
      return owners;
    }

    if (rules.mode === 'round-robin') {
      const record = await getConventionSettingsModel()
        .findOne({ userId: String(user._id), isActive: true })
        .exec();
      const cursor = record?.roundRobinCursor ?? 0;
      const selected = selectReviewersFromRules(rules, cursor);
      if (selected.reviewers.length === 0) {
        throw new AppError(
          'ReviewersRequired',
          'Round-robin reviewer mode requires at least one configured reviewer.',
          409,
          'Add reviewers to convention settings, then retry.',
        );
      }
      if (record && selected.nextCursor !== undefined) {
        record.roundRobinCursor = selected.nextCursor;
        await record.save();
      }
      return selected.reviewers;
    }

    const selected = selectReviewersFromRules(rules);
    if (selected.reviewers.length === 0) {
      throw new AppError(
        'ReviewersRequired',
        'Manual-list reviewer mode requires at least one configured reviewer.',
        409,
        'Add reviewers to convention settings, then retry.',
      );
    }
    return selected.reviewers;
  }

  private async loadCodeOwners(
    accessToken: string,
    owner: string,
    repo: string,
  ): Promise<string | null> {
    for (const path of CODEOWNERS_CANDIDATE_PATHS) {
      try {
        const file = await this.client.getRepositoryFile(accessToken, owner, repo, path);
        if (file.content?.trim()) {
          return file.content;
        }
      } catch (error) {
        if (error instanceof AppError && error.statusCode === 404) {
          continue;
        }
        throw error;
      }
    }
    return null;
  }

  private resolveHeadBranch(
    chunks: Array<{ branchName?: string | null; gitStatus?: string | null }>,
  ): string | null {
    const ready = [...chunks]
      .reverse()
      .find(
        (chunk) =>
          chunk.branchName &&
          (chunk.gitStatus === 'ready_for_pr' ||
            chunk.gitStatus === 'committed' ||
            chunk.gitStatus === 'branch_created'),
      );
    if (ready?.branchName) {
      return ready.branchName;
    }
    const anyBranch = [...chunks].reverse().find((chunk) => chunk.branchName);
    return anyBranch?.branchName ?? null;
  }

  private async loadRepoContext(user: UserDocument, workflow: WorkflowRecord) {
    const chunks = await getImplementationChunkModel()
      .find({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
      })
      .sort({ order: 1 })
      .exec();

    if (chunks.length === 0) {
      throw new AppError(
        'ChunksRequired',
        'No implementation chunks found for this workflow.',
        409,
        'Decompose an approved PRD into chunks and commit changes before creating a PR.',
      );
    }

    const prd = await getPrdModel().findById(chunks[0]!.prdId).exec();
    if (!prd || prd.userId !== String(user._id)) {
      throw new AppError(
        'PrdNotFound',
        'PRD linked to this workflow was not found.',
        404,
        'Re-decompose chunks from an approved PRD owned by the signed-in user.',
      );
    }

    const owner = prd.owner;
    const repo = prd.repo;
    if (!owner || !repo) {
      throw new AppError(
        'RepositoryRequired',
        'PRD is missing linked repository owner/repo for pull request creation.',
        409,
        'Associate a connected repository with the PRD before creating a pull request.',
      );
    }

    const connection = await repositoryService.requireConnectedRepository(user, owner, repo);
    return { owner, repo, connection, chunks, prd };
  }

  private async loadOwnedWorkflow(
    user: UserDocument,
    workflowDocumentId: string,
  ): Promise<WorkflowRecord> {
    const workflow = await getWorkflowModel().findById(workflowDocumentId).exec();
    if (!workflow || workflow.userId !== String(user._id)) {
      throw new AppError(
        'WorkflowNotFound',
        'Workflow was not found.',
        404,
        'Provide a valid workflow id belonging to the signed-in user.',
      );
    }
    return workflow;
  }

  private async transitionWorkflow(
    user: UserDocument,
    workflow: WorkflowRecord,
    toState: 'PR_CREATING' | 'PR_CREATED',
    trigger: string,
  ): Promise<void> {
    if (workflow.state === toState) {
      return;
    }

    const previousState = workflow.state;
    workflow.history.push({
      timestamp: new Date(),
      previousState,
      newState: toState,
      trigger,
    });
    workflow.state = toState;
    workflow.updatedBy = String(user._id);
    await workflow.save();

    await eventBus.publish({
      type: 'WORKFLOW_TRANSITIONED',
      payload: {
        workflowId: workflow.workflowId,
        previousState,
        newState: toState,
        trigger,
      },
      metadata: {
        eventId: randomUUID(),
        correlationId: workflow._id.toString(),
        actor: String(user._id),
        userId: String(user._id),
        timestamp: new Date().toISOString(),
      },
    });
  }
}

export const prCreationService = new PrCreationService();
