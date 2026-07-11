import type {
  CodebaseAnalysisRequest,
  CodebaseAnalysisResponse,
  ConnectedRepositoryListResponse,
  GitHubRepository,
  RepositoryConnectResponse,
  RepositoryListResponse,
} from '@autodev/shared-types';
import { apiFetch } from './client';

export async function listGitHubRepositories(): Promise<RepositoryListResponse> {
  return apiFetch<RepositoryListResponse>('/api/v1/repositories');
}

export async function listConnectedRepositories(): Promise<ConnectedRepositoryListResponse> {
  return apiFetch<ConnectedRepositoryListResponse>('/api/v1/repositories/connected');
}

export async function connectRepository(
  owner: string,
  repo: string,
): Promise<RepositoryConnectResponse> {
  return apiFetch<RepositoryConnectResponse>(
    `/api/v1/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/connect`,
    { method: 'POST' },
  );
}

export async function analyzeRepository(
  owner: string,
  repo: string,
  body: CodebaseAnalysisRequest = {},
): Promise<CodebaseAnalysisResponse> {
  return apiFetch<CodebaseAnalysisResponse>(
    `/api/v1/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/analyze`,
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
  );
}

export function repositoryKey(repository: Pick<GitHubRepository, 'owner' | 'name'>): string {
  return `${repository.owner}/${repository.name}`;
}

export function parseRepositoryFullName(fullName: string): { owner: string; repo: string } {
  const [owner = '', repo = ''] = fullName.split('/');
  return { owner, repo };
}
