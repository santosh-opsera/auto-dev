export const API_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export interface AuthUser {
  email: string;
  displayName: string;
  connectedProviders: Array<'github' | 'atlassian'>;
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

async function authFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(`Auth request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getOAuthStartUrl(provider: 'github' | 'atlassian'): string {
  return `${API_BASE_URL}/api/v1/auth/${provider}/start`;
}

export async function fetchCurrentUser(): Promise<MeResponse> {
  return authFetch<MeResponse>('/api/v1/auth/me');
}

export async function sendHeartbeat(): Promise<HeartbeatResponse> {
  return authFetch<HeartbeatResponse>('/api/v1/auth/heartbeat', { method: 'POST' });
}

export async function logout(): Promise<void> {
  await authFetch<void>('/api/v1/auth/logout', { method: 'POST' });
}
