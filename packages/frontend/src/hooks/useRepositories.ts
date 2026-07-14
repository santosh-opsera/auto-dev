import { useCallback, useEffect, useState } from 'react';
import type { CodebaseAnalysisResponse, GitHubRateLimitStatus, GitHubRepository, RepositoryConnection } from '@autodev/shared-types';
import { ApiError } from '../api/client';
import {
  analyzeRepository,
  connectRepository,
  listConnectedRepositories,
  listGitHubRepositories,
  repositoryKey,
} from '../api/repositories';

interface RepositoryState {
  available: GitHubRepository[];
  connected: RepositoryConnection[];
  loading: boolean;
  error: string | null;
  errorCode: string | null;
  rateLimitWarning: string | null;
  rateLimit: GitHubRateLimitStatus | null;
  connectingKey: string | null;
  analyzingKey: string | null;
  analysisResults: Record<string, CodebaseAnalysisResponse>;
}

const initialState: RepositoryState = {
  available: [],
  connected: [],
  loading: true,
  error: null,
  errorCode: null,
  rateLimitWarning: null,
  rateLimit: null,
  connectingKey: null,
  analyzingKey: null,
  analysisResults: {},
};

interface UseRepositoriesOptions {
  /** When false, skip GitHub available-repo auto-load (Connect GitHub banner path). */
  fetchAvailable?: boolean;
}

export function useRepositories({ fetchAvailable = true }: UseRepositoriesOptions = {}) {
  const [state, setState] = useState<RepositoryState>(initialState);

  const refresh = useCallback(async (): Promise<void> => {
    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
      errorCode: null,
      rateLimitWarning: null,
    }));

    try {
      const connectedResponse = await listConnectedRepositories();
      let available: GitHubRepository[] = [];
      let rateLimitWarning: string | null = null;
      let rateLimit: GitHubRateLimitStatus | null = null;

      if (fetchAvailable) {
        const availableResponse = await listGitHubRepositories();
        available = availableResponse.repositories;
        rateLimitWarning = availableResponse.rateLimitWarning ?? null;
        rateLimit = availableResponse.rateLimit ?? null;
      }

      setState((previous) => ({
        ...previous,
        available,
        connected: connectedResponse.connections,
        loading: false,
        rateLimitWarning,
        rateLimit,
      }));
    } catch (loadError) {
      const message =
        loadError instanceof ApiError
          ? [loadError.message, loadError.suggestedAction].filter(Boolean).join(' ')
          : loadError instanceof Error
            ? loadError.message
            : 'Failed to load repositories.';

      setState((previous) => ({
        ...previous,
        loading: false,
        error: message,
        errorCode: loadError instanceof ApiError ? (loadError.errorCode ?? null) : null,
      }));
    }
  }, [fetchAvailable]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connectedKeys = new Set(state.connected.map((connection) => `${connection.owner}/${connection.repo}`));

  const connect = useCallback(async (repository: GitHubRepository): Promise<void> => {
    const key = repositoryKey(repository);
    setState((previous) => ({ ...previous, connectingKey: key, error: null, errorCode: null }));

    try {
      const response = await connectRepository(repository.owner, repository.name);
      setState((previous) => ({
        ...previous,
        connectingKey: null,
        connected: [
          response.connection,
          ...previous.connected.filter(
            (connection) => `${connection.owner}/${connection.repo}` !== key,
          ),
        ],
      }));
    } catch (connectError) {
      const message =
        connectError instanceof ApiError
          ? [connectError.message, connectError.suggestedAction].filter(Boolean).join(' ')
          : connectError instanceof Error
            ? connectError.message
            : 'Failed to connect repository.';

      setState((previous) => ({
        ...previous,
        connectingKey: null,
        error: message,
        errorCode: connectError instanceof ApiError ? (connectError.errorCode ?? null) : null,
      }));
    }
  }, []);

  const analyze = useCallback(
    async (connection: RepositoryConnection, ticketKey?: string): Promise<void> => {
      const key = `${connection.owner}/${connection.repo}`;
      setState((previous) => ({ ...previous, analyzingKey: key, error: null, errorCode: null }));

      try {
        const response = await analyzeRepository(connection.owner, connection.repo, {
          ticketKey,
          workflowId: `repo-analysis-${Date.now()}`,
        });

        setState((previous) => ({
          ...previous,
          analyzingKey: null,
          analysisResults: {
            ...previous.analysisResults,
            [key]: response,
          },
        }));
      } catch (analyzeError) {
        const message =
          analyzeError instanceof ApiError
            ? [analyzeError.message, analyzeError.suggestedAction].filter(Boolean).join(' ')
            : analyzeError instanceof Error
              ? analyzeError.message
              : 'Failed to analyze repository.';

        setState((previous) => ({
          ...previous,
          analyzingKey: null,
          error: message,
          errorCode: analyzeError instanceof ApiError ? (analyzeError.errorCode ?? null) : null,
        }));
      }
    },
    [],
  );

  return {
    ...state,
    connectedKeys,
    refresh,
    connect,
    analyze,
  };
}
