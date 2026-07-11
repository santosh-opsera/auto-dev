import { randomUUID } from 'node:crypto';
import type { CodebaseAnalysisResponse, RepositoryTreeEntry } from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import {
  buildAnalysisExpiryDate,
  getCodebaseContextModel,
} from '../../models/codebaseContextModel.js';
import { AppError } from '../../utils/errors.js';
import { eventBus } from '../events/eventBus.js';
import { repositoryService } from '../github/repositoryService.js';
import {
  analyzeCodebase,
  computeTreeFingerprint,
} from './codebaseAnalysisEngine.js';

const MAX_ON_DEMAND_FILES = 40;

export interface AnalyzeRepositoryOptions {
  ticketKey?: string;
  workflowId?: string;
  forceRefresh?: boolean;
}

export class CodebaseAnalysisService {
  async analyzeRepository(
    user: UserDocument,
    owner: string,
    repo: string,
    options: AnalyzeRepositoryOptions = {},
  ): Promise<CodebaseAnalysisResponse> {
    const workflowId = options.workflowId ?? randomUUID();
    const treeResponse = await repositoryService.getRepositoryTree(user, owner, repo);
    const treeFingerprint = computeTreeFingerprint(treeResponse.tree);

    if (!options.forceRefresh) {
      const cached = await getCodebaseContextModel()
        .findOne({
          userId: String(user._id),
          owner,
          repo,
          treeFingerprint,
          expiresAt: { $gt: new Date() },
        })
        .exec();

      if (cached) {
        return {
          context: cached.context,
          persistedId: cached._id.toString(),
          cacheHit: true,
        };
      }
    }

    await eventBus.publish(
      {
        type: 'ANALYSIS_STARTED',
        payload: { ticketKey: options.ticketKey, workflowId, owner, repo },
        metadata: this.buildMetadata(user, workflowId, owner, repo),
      },
      { awaitHandlers: true },
    );

    await this.publishProgress(user, workflowId, 25, 'Fetching repository files');

    const fileContents = await this.loadSourceFiles(user, owner, repo, treeResponse.tree);

    await this.publishProgress(user, workflowId, 60, 'Detecting conventions and patterns');

    const context = analyzeCodebase({
      owner,
      repo,
      branch: treeResponse.branch,
      tree: treeResponse.tree,
      fileContents,
      treeSha: treeFingerprint,
    });

    await this.publishProgress(user, workflowId, 90, 'Persisting analysis results');

    const record = await getCodebaseContextModel().findOneAndUpdate(
      { userId: String(user._id), owner, repo },
      {
        $set: {
          userId: String(user._id),
          owner,
          repo,
          branch: treeResponse.branch,
          treeFingerprint,
          context,
          expiresAt: buildAnalysisExpiryDate(),
          updatedBy: String(user._id),
        },
        $setOnInsert: {
          createdBy: String(user._id),
        },
      },
      { upsert: true, new: true },
    );

    if (!record) {
      throw new AppError(
        'AnalysisPersistFailed',
        'Unable to persist codebase analysis results.',
        500,
        'Retry the analysis request.',
      );
    }

    const findingsCount =
      context.designPatterns.length +
      context.namingConventions.length +
      context.architecturalLayers.length;

    await eventBus.publish(
      {
        type: 'ANALYSIS_COMPLETED',
        payload: {
          ticketKey: options.ticketKey,
          workflowId,
          owner,
          repo,
          findingsCount,
        },
        metadata: this.buildMetadata(user, workflowId, owner, repo),
      },
      { awaitHandlers: true },
    );

    return {
      context,
      persistedId: record._id.toString(),
      cacheHit: false,
    };
  }

  private async loadSourceFiles(
    user: UserDocument,
    owner: string,
    repo: string,
    tree: RepositoryTreeEntry[],
  ): Promise<Record<string, string>> {
    const sourceFiles = tree
      .filter(
        (entry) =>
          entry.type === 'file' &&
          /\.(ts|tsx|js|jsx)$/.test(entry.path) &&
          !entry.path.includes('node_modules') &&
          !entry.path.includes('dist/'),
      )
      .slice(0, MAX_ON_DEMAND_FILES);

    const contents: Record<string, string> = {};

    await Promise.all(
      sourceFiles.map(async (entry) => {
        try {
          const file = await repositoryService.getRepositoryFile(user, owner, repo, entry.path);
          contents[entry.path] = file.content;
        } catch {
          // Skip unreadable files during analysis.
        }
      }),
    );

    return contents;
  }

  private async publishProgress(
    user: UserDocument,
    workflowId: string,
    progressPercent: number,
    phase: string,
  ): Promise<void> {
    await eventBus.publish(
      {
        type: 'ANALYSIS_PROGRESS',
        payload: { workflowId, progressPercent, phase },
        metadata: {
          eventId: randomUUID(),
          correlationId: workflowId,
          actor: String(user._id),
          userId: String(user._id),
          timestamp: new Date().toISOString(),
        },
      },
      { awaitHandlers: true },
    );
  }

  private buildMetadata(
    user: UserDocument,
    workflowId: string,
    owner: string,
    repo: string,
  ) {
    return {
      eventId: randomUUID(),
      correlationId: `${owner}/${repo}:${workflowId}`,
      actor: String(user._id),
      userId: String(user._id),
      timestamp: new Date().toISOString(),
    };
  }
}

export const codebaseAnalysisService = new CodebaseAnalysisService();
