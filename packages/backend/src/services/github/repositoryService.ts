import type {
  GitHubRateLimitStatus,
  RepositoryConnectResponse,
  RepositoryConnection,
  RepositoryFileResponse,
  RepositoryListResponse,
  RepositoryTreeResponse,
} from '@autodev/shared-types';
import { decryptSecret } from '../../lib/encryption.js';
import { AppError } from '../../utils/errors.js';
import type { UserDocument } from '../../models/userModel.js';
import { getRepositoryConnectionModel } from '../../models/repositoryConnectionModel.js';
import { GitHubApiClient, githubApiClient } from './githubApiClient.js';

function resolveGitHubAccessToken(user: UserDocument): string {
  const github = user.github;

  if (!github?.encryptedAccessToken) {
    throw new AppError(
      'GitHubNotConnected',
      'Connect GitHub before accessing repositories.',
      412,
      'Sign in with GitHub and grant repository access, then retry.',
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

export class RepositoryService {
  constructor(private readonly client: GitHubApiClient = githubApiClient) {}

  async listRepositories(user: UserDocument): Promise<RepositoryListResponse> {
    const accessToken = resolveGitHubAccessToken(user);
    const repositories = await this.client.listRepositories(accessToken);
    return { repositories };
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
    const accessToken = resolveGitHubAccessToken(user);
    const connection = await getRepositoryConnectionModel()
      .findOne({ userId: String(user._id), owner, repo })
      .exec();

    const branch = connection?.defaultBranch ?? 'main';
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
