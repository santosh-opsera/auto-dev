import type {
  GitHubRateLimitStatus,
  GitHubRepository,
  RepositoryConnectResponse,
  RepositoryConnection,
  ConnectedRepositoryListResponse,
  RepositoryFileResponse,
  RepositoryListResponse,
  RepositoryTreeResponse,
} from '@autodev/shared-types';
import { decryptSecret } from '../../lib/encryption.js';
import { AppError } from '../../utils/errors.js';
import type { UserDocument } from '../../models/userModel.js';
import { getRepositoryConnectionModel } from '../../models/repositoryConnectionModel.js';
import {
  buildRepositoryListCacheTimestamps,
  getRepositoryListCacheModel,
  REPOSITORY_LIST_CACHE_TTL_MS,
} from '../../models/repositoryListCacheModel.js';
import { userHasGitHubRepoScopes } from './githubScopes.js';
import { GitHubApiClient, githubApiClient } from './githubApiClient.js';

/** Warn when GitHub API remaining quota drops below this threshold. */
export const REPO_LIST_RATE_LIMIT_WARN_THRESHOLD = 50;

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

function toConnection(record: {
  _id: { toString(): string };
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
  connectedAt: Date;
}): RepositoryConnection {
  return {
    id: record._id.toString(),
    owner: record.owner,
    repo: record.repo,
    fullName: record.fullName,
    defaultBranch: record.defaultBranch,
    connectedAt: record.connectedAt.toISOString(),
  };
}

function formatResetRelative(resetAtMs: number, nowMs: number = Date.now()): string {
  if (!resetAtMs) {
    return 'unknown time';
  }
  const minutes = Math.max(1, Math.ceil((resetAtMs - nowMs) / 60_000));
  return `about ${String(minutes)} minute${minutes === 1 ? '' : 's'} (${new Date(resetAtMs).toISOString()})`;
}

function buildRateLimitWarning(rateLimit: GitHubRateLimitStatus): string | undefined {
  if (rateLimit.remaining >= REPO_LIST_RATE_LIMIT_WARN_THRESHOLD) {
    return undefined;
  }

  return `GitHub API rate limit is low (${String(rateLimit.remaining)} of ${String(rateLimit.limit)} remaining). Resets in ${formatResetRelative(Date.parse(rateLimit.resetAt))}.`;
}

function paginateRepositories(
  allRepositories: GitHubRepository[],
  options: { page: number; perPage: number; q?: string },
): Pick<RepositoryListResponse, 'repositories' | 'pagination'> {
  const query = options.q?.trim().toLowerCase();
  const filtered = query
    ? allRepositories.filter(
        (repository) =>
          repository.fullName.toLowerCase().includes(query) ||
          repository.name.toLowerCase().includes(query),
      )
    : allRepositories;

  const totalCount = filtered.length;
  const start = (options.page - 1) * options.perPage;
  const repositories = filtered.slice(start, start + options.perPage);

  return {
    repositories,
    pagination: {
      page: options.page,
      perPage: options.perPage,
      totalCount,
      hasNextPage: start + repositories.length < totalCount,
    },
  };
}

export class RepositoryService {
  constructor(private readonly client: GitHubApiClient = githubApiClient) {}

  async listConnectedRepositories(user: UserDocument): Promise<ConnectedRepositoryListResponse> {
    const records = await getRepositoryConnectionModel()
      .find({ userId: String(user._id) })
      .sort({ connectedAt: -1 })
      .exec();

    return {
      connections: records.map((record) => toConnection(record)),
    };
  }

  async requireConnectedRepository(
    user: UserDocument,
    owner: string,
    repo: string,
  ): Promise<RepositoryConnection> {
    const record = await getRepositoryConnectionModel()
      .findOne({ userId: String(user._id), owner, repo })
      .exec();

    if (!record) {
      throw new AppError(
        'RepositoryNotConnected',
        'This repository has not been connected yet.',
        412,
        'Connect the repository from the repositories page before running analysis.',
      );
    }

    return toConnection(record);
  }

  async invalidateRepositoryListCache(userId: string): Promise<void> {
    await getRepositoryListCacheModel().deleteOne({ userId }).exec();
  }

  async listRepositories(
    user: UserDocument,
    options: { page?: number; perPage?: number; q?: string; refresh?: boolean } = {},
  ): Promise<RepositoryListResponse> {
    const page = options.page ?? 1;
    const perPage = options.perPage ?? 30;
    const userId = String(user._id);
    const forceRefresh = options.refresh === true;
    const now = new Date();

    if (!forceRefresh) {
      const cached = await getRepositoryListCacheModel().findOne({ userId }).exec();
      if (cached && cached.freshUntil > now) {
        const rateLimit = this.getRateLimitStatus();
        const rateLimitWarning = buildRateLimitWarning(rateLimit);
        return {
          ...paginateRepositories(cached.repositories, { page, perPage, q: options.q }),
          rateLimit,
          ...(rateLimitWarning ? { rateLimitWarning } : {}),
          cachedAt: cached.cachedAt.toISOString(),
          cacheExpiresAt: cached.freshUntil.toISOString(),
          fromCache: true,
        };
      }
    } else {
      await this.invalidateRepositoryListCache(userId);
    }

    try {
      const accessToken = resolveGitHubAccessToken(user);
      const allRepositories = await this.client.listRepositories(accessToken);
      const timestamps = buildRepositoryListCacheTimestamps(now);

      await getRepositoryListCacheModel().findOneAndUpdate(
        { userId },
        {
          $set: {
            userId,
            repositories: allRepositories,
            cachedAt: timestamps.cachedAt,
            freshUntil: timestamps.freshUntil,
            expiresAt: timestamps.expiresAt,
            updatedBy: userId,
            dataClassification: 'internal',
          },
          $setOnInsert: {
            createdBy: userId,
          },
        },
        { upsert: true, new: true },
      );

      const rateLimit = this.getRateLimitStatus();
      const rateLimitWarning = buildRateLimitWarning(rateLimit);

      return {
        ...paginateRepositories(allRepositories, { page, perPage, q: options.q }),
        rateLimit,
        ...(rateLimitWarning ? { rateLimitWarning } : {}),
        cachedAt: timestamps.cachedAt.toISOString(),
        cacheExpiresAt: timestamps.freshUntil.toISOString(),
        fromCache: false,
      };
    } catch (error) {
      const stale = await getRepositoryListCacheModel().findOne({ userId }).exec();
      if (stale && stale.repositories.length > 0) {
        const rateLimit = this.getRateLimitStatus();
        return {
          ...paginateRepositories(stale.repositories, { page, perPage, q: options.q }),
          rateLimit,
          cachedAt: stale.cachedAt.toISOString(),
          cacheExpiresAt: stale.freshUntil.toISOString(),
          fromCache: true,
          cacheWarning: `GitHub is unavailable or rate-limited. Showing cached repositories from ${stale.cachedAt.toISOString()}. Data may be outdated.`,
        };
      }

      throw error;
    }
  }

  async connectRepository(
    user: UserDocument,
    owner: string,
    repo: string,
  ): Promise<RepositoryConnectResponse> {
    const accessToken = resolveGitHubAccessToken(user);
    const repository = await this.client.getRepository(accessToken, owner, repo);

    const record = await getRepositoryConnectionModel().findOneAndUpdate(
      { userId: String(user._id), owner, repo },
      {
        $set: {
          userId: String(user._id),
          owner,
          repo,
          fullName: repository.fullName,
          defaultBranch: repository.defaultBranch,
          connectedAt: new Date(),
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
        'RepositoryConnectFailed',
        'Unable to store repository connection.',
        500,
        'Retry the connect request.',
      );
    }

    return { connection: toConnection(record) };
  }

  async getRepositoryTree(
    user: UserDocument,
    owner: string,
    repo: string,
  ): Promise<RepositoryTreeResponse> {
    const connection = await this.requireConnectedRepository(user, owner, repo);
    const accessToken = resolveGitHubAccessToken(user);
    const branch = connection.defaultBranch;
    const tree = await this.client.getRepositoryTree(accessToken, owner, repo, branch);

    return {
      owner,
      repo,
      branch,
      tree,
    };
  }

  async getRepositoryFile(
    user: UserDocument,
    owner: string,
    repo: string,
    path: string,
  ): Promise<RepositoryFileResponse> {
    await this.requireConnectedRepository(user, owner, repo);
    const accessToken = resolveGitHubAccessToken(user);
    return this.client.getRepositoryFile(accessToken, owner, repo, path);
  }

  getRateLimitStatus(): GitHubRateLimitStatus {
    const snapshot = this.client.getRateLimiter().getSnapshot();
    return {
      limit: snapshot.limit,
      remaining: snapshot.remaining,
      resetAt: new Date(snapshot.resetAt || Date.now()).toISOString(),
      queuedRequests: snapshot.queuedRequests,
    };
  }
}

export const repositoryService = new RepositoryService();

export { REPOSITORY_LIST_CACHE_TTL_MS };
