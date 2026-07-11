import { apiFetch } from './client';

export interface AuthUser {
  email: string;
  displayName: string;
  connectedProviders: Array<'github' | 'atlassian'>;
  integrations?: {
    jira: boolean;
  };
}

export interface SessionMetadata {
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

export function getOAuthStartUrl(provider: 'github' | 'atlassian'): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/v1/auth/${provider}/start`;
}

export function getJiraConnectUrl(): string {
  const base = import.meta.env.VITE_API_URL ?? '';
  return `${base}/api/v1/auth/atlassian/jira/connect`;
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
