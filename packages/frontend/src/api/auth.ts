import { apiFetch } from './client';

export interface AuthUser {
  email: string;
  displayName: string;
  connectedProviders: Array<'github' | 'atlassian'>;
  integrations?: {
    jira: boolean;
    githubRepos: boolean;
    atlassianEmail?: string;
  };
}

export interface SessionMetadata {
  sessionId?: string;
  remainingMs: number;
  warning?: boolean;
  expiresAt?: string;
}

export interface MeResponse {
  user: AuthUser;
  session: SessionMetadata;
}

export interface HeartbeatResponse {
  session: SessionMetadata;
  warning?: string;
}

export { API_BASE_URL } from './client.js';

export function getOAuthStartUrl(provider: 'github'): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/v1/auth/${provider}/start`;
}

/** Clears stale Atlassian remember cookies before showing GitHub-only login. */
export async function prepareLoginPage(): Promise<void> {
  const base = import.meta.env.VITE_API_URL ?? '';
  try {
    await fetch(`${base}/api/v1/auth/prepare-login`, {
      method: 'GET',
      credentials: 'include',
    });
  } catch {
    // Best-effort: login UI still works if the prepare call fails.
  }
}

export function getJiraConnectUrl(returnTo?: string): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  const url = `${base}/api/v1/auth/atlassian/jira/connect`;
  if (!returnTo) {
    return url;
  }
  const params = new URLSearchParams({ returnTo });
  return `${url}?${params.toString()}`;
}

export function getGitHubReposConnectUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/v1/auth/github/repos/connect`;
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/api/v1/auth/me');
}

export async function sendHeartbeat(): Promise<HeartbeatResponse> {
  return apiFetch<HeartbeatResponse>('/api/v1/auth/heartbeat', { method: 'POST' });
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/api/v1/auth/logout', { method: 'POST' });
}
