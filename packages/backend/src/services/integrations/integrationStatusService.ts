import type {
  IntegrationAdapterInfo,
  IntegrationConnectionState,
  IntegrationProviderStatus,
  IntegrationsStatusResponse,
} from '@autodev/shared-types';
import type { UserDocument } from '../../models/userModel.js';
import { userHasGitHubAccount, userHasGitHubRepoScopes } from '../github/githubScopes.js';
import { userHasJiraScopes } from '../jira/jiraScopes.js';
import { adapterRegistry } from './adapterRegistry.js';
import { registerDefaultAdapters } from './registerDefaultAdapters.js';

function isAccessTokenExpired(tokenExpiresAt?: Date): boolean {
  return tokenExpiresAt !== undefined && tokenExpiresAt.getTime() <= Date.now();
}

function lastCheckedAt(adapter: IntegrationAdapterInfo | undefined, fallback: string): string {
  return adapter?.lastHealthCheck?.checkedAt ?? fallback;
}

function resolveConnectionState(options: {
  connected: boolean;
  tokenExpired: boolean;
  adapterError: boolean;
}): IntegrationConnectionState {
  if (!options.connected) {
    return 'disconnected';
  }
  if (options.tokenExpired) {
    return 'expired';
  }
  if (options.adapterError) {
    return 'error';
  }
  return 'connected';
}

function buildGitHubStatus(
  user: UserDocument,
  adapter: IntegrationAdapterInfo | undefined,
  checkedAt: string,
): IntegrationProviderStatus {
  const hasToken = userHasGitHubAccount(user);
  const hasRepoScopes = userHasGitHubRepoScopes(user);
  const connected = hasToken && hasRepoScopes;
  const tokenExpired = isAccessTokenExpired(user.github?.tokenExpiresAt);
  const tokenValid = connected && !tokenExpired;
  const connectionState = resolveConnectionState({
    connected,
    tokenExpired: connected && tokenExpired,
    adapterError: adapter?.status === 'error',
  });

  return {
    name: 'github',
    connected,
    tokenValid,
    connectionState,
    lastCheckedAt: lastCheckedAt(adapter, checkedAt),
    ...(user.github?.tokenExpiresAt
      ? { tokenExpiresAt: user.github.tokenExpiresAt.toISOString() }
      : {}),
    ...(connectionState === 'disconnected' ? { message: 'GitHub not connected' } : {}),
  };
}

function buildJiraStatus(
  user: UserDocument,
  adapter: IntegrationAdapterInfo | undefined,
  checkedAt: string,
): IntegrationProviderStatus {
  const hasToken = Boolean(user.atlassian?.encryptedAccessToken);
  const hasScopes = userHasJiraScopes(user);
  const connected = hasToken && hasScopes;
  const tokenExpired = isAccessTokenExpired(user.atlassian?.tokenExpiresAt);
  const tokenValid = connected && !tokenExpired;
  const connectionState = resolveConnectionState({
    connected,
    tokenExpired: connected && tokenExpired,
    adapterError: adapter?.status === 'error',
  });

  return {
    name: 'jira',
    connected,
    tokenValid,
    connectionState,
    lastCheckedAt: lastCheckedAt(adapter, checkedAt),
    ...(user.atlassian?.tokenExpiresAt
      ? { tokenExpiresAt: user.atlassian.tokenExpiresAt.toISOString() }
      : {}),
    ...(connectionState === 'expired'
      ? { message: 'Jira connection expired — Reconnect' }
      : connectionState === 'disconnected'
        ? { message: 'Jira not connected' }
        : {}),
  };
}

/**
 * Builds per-user GitHub/Jira health for the IntegrationBanner and status API.
 * Combines stored OAuth tokens with adapter-registry last health check times.
 */
export function getIntegrationsStatus(user: UserDocument): IntegrationsStatusResponse {
  registerDefaultAdapters();
  const checkedAt = new Date().toISOString();
  const adapters = new Map(adapterRegistry.list().map((entry) => [entry.name, entry]));

  return {
    github: buildGitHubStatus(user, adapters.get('github'), checkedAt),
    jira: buildJiraStatus(user, adapters.get('jira'), checkedAt),
    checkedAt,
  };
}
