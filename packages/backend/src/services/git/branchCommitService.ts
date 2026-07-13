import type {
  BranchNamePreviewResponse,
  ChunkBranchResponse,
  ChunkCommitResponse,
  CommitChunkFile,
  CommitChunkRequest,
  CommitMessagePreviewResponse,
  CreateChunkBranchRequest,
  ImplementationChunkResponse,
} from '@autodev/shared-types';
import { canTransitionChunkStatus } from '@autodev/shared-types';
import { defaultConventionTemplates } from '../../fixtures/conventionDefaults.js';
import { decryptSecret } from '../../lib/encryption.js';
import type { UserDocument } from '../../models/userModel.js';
import {
  getImplementationChunkModel,
  type ImplementationChunkRecord,
} from '../../models/implementationChunkModel.js';
import { getPrdModel } from '../../models/prdModel.js';
import { getWorkflowModel, type WorkflowRecord } from '../../models/workflowModel.js';
import { AppError } from '../../utils/errors.js';
import { auditService } from '../audit/auditService.js';
import { conventionService } from '../conventions/conventionService.js';
import {
  generateBranchName,
  generateCommitMessage,
  validateCommitMessageAgainstFormat,
} from '../conventions/conventionNaming.js';
import { userHasGitHubRepoScopes } from '../github/githubScopes.js';
import { GitHubApiClient, githubApiClient } from '../github/githubApiClient.js';
import { repositoryService } from '../github/repositoryService.js';

function mapChunk(doc: ImplementationChunkRecord): ImplementationChunkResponse {
  return {
    id: doc._id.toString(),
    workflowDocumentId: doc.workflowDocumentId,
    workflowId: doc.workflowId,
    prdId: doc.prdId,
    order: doc.order,
    name: doc.name,
    description: doc.description,
    scope: {
      files: [...doc.scope.files],
      modules: [...doc.scope.modules],
    },
    dependencies: [...doc.dependencies],
    estimatedComplexity: doc.estimatedComplexity,
    status: doc.status,
    branchName: doc.branchName,
    branchHeadSha: doc.branchHeadSha,
    lastCommitSha: doc.lastCommitSha,
    lastCommitMessage: doc.lastCommitMessage,
    gitStatus: doc.gitStatus,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
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

function resolveBranchNameTemplate(template: string | undefined): string {
  return template?.trim() || defaultConventionTemplates.branchNameTemplate;
}

/** Prefer first alternation group from the configured regex (e.g. feature|bugfix). */
function defaultTypeFromPattern(pattern: string): string {
  const groupMatch = pattern.match(/\(([^)]+)\)/);
  if (groupMatch?.[1]) {
    const first = groupMatch[1]
      .split('|')[0]
      ?.replace(/[^a-zA-Z0-9/_-]/g, '')
      .trim();
    if (first) {
      return first;
    }
  }
  return 'feature';
}

export class BranchCommitService {
  constructor(private readonly client: GitHubApiClient = githubApiClient) {}

  async previewBranchName(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: { type?: string; description?: string } = {},
  ): Promise<BranchNamePreviewResponse> {
    const { workflow, chunk, conventions } = await this.loadContext(
      user,
      workflowDocumentId,
      chunkId,
    );
    const branchNameTemplate = resolveBranchNameTemplate(conventions.branchNameTemplate);
    const generated = generateBranchName({
      branchNameTemplate,
      branchNamingPattern: conventions.branchNamingPattern,
      type: input.type?.trim() || defaultTypeFromPattern(conventions.branchNamingPattern),
      ticketKey: workflow.ticketKey,
      description: input.description?.trim() || chunk.name,
    });

    return {
      branchName: generated.branchName,
      branchNameTemplate,
      branchNamingPattern: conventions.branchNamingPattern,
      valid: generated.valid,
      ticketKey: workflow.ticketKey,
    };
  }

  async previewCommitMessage(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: { description?: string } = {},
  ): Promise<CommitMessagePreviewResponse> {
    const { workflow, chunk, conventions } = await this.loadContext(
      user,
      workflowDocumentId,
      chunkId,
    );
    const generated = generateCommitMessage({
      commitMessageFormat: conventions.commitMessageFormat,
      ticketKey: workflow.ticketKey,
      description: input.description?.trim() || chunk.name,
    });

    return {
      commitMessage: generated.commitMessage,
      commitMessageFormat: conventions.commitMessageFormat,
      valid: generated.valid,
      ticketKey: workflow.ticketKey,
    };
  }

  async createBranch(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: CreateChunkBranchRequest = {},
  ): Promise<ChunkBranchResponse> {
    const { workflow, chunk, conventions, owner, repo, connection } = await this.loadRepoContext(
      user,
      workflowDocumentId,
      chunkId,
    );

    const branchNameTemplate = resolveBranchNameTemplate(conventions.branchNameTemplate);
    const generated = generateBranchName({
      branchNameTemplate,
      branchNamingPattern: conventions.branchNamingPattern,
      type: input.type?.trim() || defaultTypeFromPattern(conventions.branchNamingPattern),
      ticketKey: workflow.ticketKey,
      description: input.description?.trim() || chunk.name,
    });

    if (!generated.valid) {
      throw new AppError(
        'InvalidBranchName',
        generated.reason ?? 'Generated branch name failed convention validation.',
        400,
        'Update convention branchNameTemplate / branchNamingPattern, or adjust type/description.',
      );
    }

    if (chunk.branchName && chunk.gitStatus && chunk.gitStatus !== 'none') {
      if (chunk.branchName !== generated.branchName) {
        throw new AppError(
          'BranchAlreadyExists',
          `Chunk already has branch "${chunk.branchName}".`,
          409,
          'Use the existing branch for commits, or create a new chunk.',
        );
      }

      return {
        chunk: mapChunk(chunk),
        branchName: chunk.branchName,
        baseBranch: connection.defaultBranch,
        headSha: chunk.branchHeadSha ?? '',
        owner,
        repo,
        created: false,
      };
    }

    const accessToken = resolveGitHubAccessToken(user);
    const baseRef = await this.client.getRef(
      accessToken,
      owner,
      repo,
      connection.defaultBranch,
    );
    const createdRef = await this.client.createRef(
      accessToken,
      owner,
      repo,
      generated.branchName,
      baseRef.sha,
    );

    if (chunk.status === 'PENDING' && canTransitionChunkStatus(chunk.status, 'IN_PROGRESS')) {
      chunk.status = 'IN_PROGRESS';
    }

    chunk.branchName = generated.branchName;
    chunk.branchHeadSha = createdRef.sha;
    chunk.gitStatus = 'branch_created';
    chunk.updatedBy = String(user._id);
    await chunk.save();

    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/branch`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        branchName: generated.branchName,
        baseBranch: connection.defaultBranch,
        headSha: createdRef.sha,
        owner,
        repo,
        ticketKey: workflow.ticketKey,
        actor: String(user._id),
      },
    });

    return {
      chunk: mapChunk(chunk),
      branchName: generated.branchName,
      baseBranch: connection.defaultBranch,
      headSha: createdRef.sha,
      owner,
      repo,
      created: true,
    };
  }

  async commitChanges(
    user: UserDocument,
    workflowDocumentId: string,
    chunkId: string,
    input: CommitChunkRequest = {},
  ): Promise<ChunkCommitResponse> {
    const { workflow, chunk, conventions, owner, repo } = await this.loadRepoContext(
      user,
      workflowDocumentId,
      chunkId,
    );

    if (!chunk.branchName || !chunk.branchHeadSha) {
      throw new AppError(
        'BranchRequired',
        'Create a convention-compliant branch before committing chunk changes.',
        409,
        'POST /api/v1/workflows/:id/chunks/:chunkId/branch first.',
      );
    }

    const files = input.files ?? [];
    if (files.length === 0) {
      throw new AppError(
        'CommitFilesRequired',
        'At least one file change is required to create a commit.',
        400,
        'Provide files: [{ path, content, encoding? }].',
      );
    }

    this.assertFilesWithinChunkScope(chunk, files);

    const autoDescription = chunk.name;
    let commitMessage: string;

    if (input.message?.trim()) {
      commitMessage = input.message.trim();
      const valid = validateCommitMessageAgainstFormat(
        commitMessage,
        conventions.commitMessageFormat,
        { ticketKey: workflow.ticketKey },
      );
      if (!valid || !commitMessage.includes(workflow.ticketKey)) {
        throw new AppError(
          'InvalidCommitMessage',
          `Commit message does not match configured format "${conventions.commitMessageFormat}" or is missing ticket key "${workflow.ticketKey}".`,
          400,
          'Omit message to auto-generate from conventions, or supply a message that includes the Jira ticket key.',
        );
      }
    } else {
      const generated = generateCommitMessage({
        commitMessageFormat: conventions.commitMessageFormat,
        ticketKey: workflow.ticketKey,
        description: autoDescription,
      });
      if (!generated.valid) {
        throw new AppError(
          'InvalidCommitMessage',
          generated.reason ?? 'Generated commit message failed convention validation.',
          400,
          'Update convention commitMessageFormat so generated messages include the Jira ticket key.',
        );
      }
      commitMessage = generated.commitMessage;
    }

    const accessToken = resolveGitHubAccessToken(user);
    const headCommit = await this.client.getCommit(
      accessToken,
      owner,
      repo,
      chunk.branchHeadSha,
    );

    const treeEntries = [];
    for (const file of files) {
      const blob = await this.client.createBlob(
        accessToken,
        owner,
        repo,
        file.content,
        file.encoding ?? 'utf-8',
      );
      treeEntries.push({
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha,
      });
    }

    const tree = await this.client.createTree(
      accessToken,
      owner,
      repo,
      headCommit.treeSha,
      treeEntries,
    );

    const commit = await this.client.createCommit(accessToken, owner, repo, {
      message: commitMessage,
      treeSha: tree.sha,
      parentShas: [headCommit.sha],
    });

    await this.client.updateRef(accessToken, owner, repo, chunk.branchName, commit.sha);

    const siblings = await getImplementationChunkModel()
      .find({
        userId: String(user._id),
        workflowDocumentId: workflow._id.toString(),
      })
      .exec();

    const othersComplete = siblings
      .filter((sibling) => sibling._id.toString() !== chunk._id.toString())
      .every((sibling) => sibling.status === 'COMPLETED' || sibling.status === 'SKIPPED');

    if (chunk.status === 'IN_PROGRESS' && canTransitionChunkStatus(chunk.status, 'COMPLETED')) {
      chunk.status = 'COMPLETED';
    }

    chunk.lastCommitSha = commit.sha;
    chunk.lastCommitMessage = commitMessage;
    chunk.branchHeadSha = commit.sha;
    chunk.gitStatus = othersComplete ? 'ready_for_pr' : 'committed';
    chunk.updatedBy = String(user._id);
    await chunk.save();

    const readyForPr =
      chunk.gitStatus === 'ready_for_pr' &&
      siblings.every(
        (sibling) =>
          sibling.status === 'COMPLETED' ||
          sibling.status === 'SKIPPED' ||
          sibling._id.toString() === chunk._id.toString(),
      );

    if (readyForPr && chunk.gitStatus !== 'ready_for_pr') {
      chunk.gitStatus = 'ready_for_pr';
      await chunk.save();
    }

    // Mark all completed siblings ready when workflow chunks are done
    if (readyForPr) {
      await getImplementationChunkModel()
        .updateMany(
          {
            userId: String(user._id),
            workflowDocumentId: workflow._id.toString(),
            status: 'COMPLETED',
            branchName: { $exists: true },
          },
          { $set: { gitStatus: 'ready_for_pr', updatedBy: String(user._id) } },
        )
        .exec();
      chunk.gitStatus = 'ready_for_pr';
    }

    await auditService.logSafe({
      resource: `workflows/${workflowDocumentId}/chunks/${chunkId}/commit`,
      operation: 'create',
      actor: String(user._id),
      newValue: {
        branchName: chunk.branchName,
        commitSha: commit.sha,
        commitMessage,
        filesCommitted: files.map((file) => file.path),
        owner,
        repo,
        ticketKey: workflow.ticketKey,
        actor: String(user._id),
        readyForPr,
      },
    });

    return {
      chunk: mapChunk(chunk),
      branchName: chunk.branchName,
      commitSha: commit.sha,
      commitMessage,
      owner,
      repo,
      filesCommitted: files.map((file) => file.path),
      readyForPr,
    };
  }

  private assertFilesWithinChunkScope(
    chunk: ImplementationChunkRecord,
    files: CommitChunkFile[],
  ): void {
    const allowed = new Set(chunk.scope.files);
    if (allowed.size === 0) {
      return;
    }

    const unexpected = files.map((file) => file.path).filter((path) => !allowed.has(path));
    if (unexpected.length > 0) {
      throw new AppError(
        'CommitOutOfScope',
        `Commit includes files outside chunk scope: ${unexpected.join(', ')}.`,
        400,
        'Only commit files listed in the chunk scope.',
      );
    }
  }

  private async loadContext(user: UserDocument, workflowDocumentId: string, chunkId: string) {
    const workflow = await this.loadOwnedWorkflow(user, workflowDocumentId);
    const chunk = await this.loadOwnedChunk(user, workflow, chunkId);
    const conventions = await conventionService.getActive(String(user._id));
    if (!conventions) {
      throw new AppError(
        'ConventionsRequired',
        'Convention settings must be configured before branch/commit operations.',
        409,
        'Create convention settings (branch naming and commit message format) first.',
      );
    }

    return { workflow, chunk, conventions };
  }

  private async loadRepoContext(user: UserDocument, workflowDocumentId: string, chunkId: string) {
    const context = await this.loadContext(user, workflowDocumentId, chunkId);
    const prd = await getPrdModel().findById(context.chunk.prdId).exec();
    if (!prd || prd.userId !== String(user._id)) {
      throw new AppError(
        'PrdNotFound',
        'PRD linked to this chunk was not found.',
        404,
        'Re-decompose chunks from an approved PRD owned by the signed-in user.',
      );
    }

    const owner = prd.owner;
    const repo = prd.repo;
    if (!owner || !repo) {
      throw new AppError(
        'RepositoryRequired',
        'PRD is missing linked repository owner/repo for Git operations.',
        409,
        'Associate a connected repository with the PRD before creating branches.',
      );
    }

    const connection = await repositoryService.requireConnectedRepository(user, owner, repo);
    return { ...context, owner, repo, connection, prd };
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

  private async loadOwnedChunk(
    user: UserDocument,
    workflow: WorkflowRecord,
    chunkId: string,
  ): Promise<ImplementationChunkRecord> {
    const chunk = await getImplementationChunkModel().findById(chunkId).exec();
    if (
      !chunk ||
      chunk.userId !== String(user._id) ||
      chunk.workflowDocumentId !== workflow._id.toString()
    ) {
      throw new AppError(
        'ChunkNotFound',
        'Implementation chunk was not found for this workflow.',
        404,
        'Use a valid chunkId belonging to the workflow.',
      );
    }
    return chunk;
  }
}

export const branchCommitService = new BranchCommitService();
