import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import {
  authenticatedSession,
  expiredSession,
  expiringSession,
  mockAuthUser,
  mockGithubOnlyAuthUser,
} from '../fixtures/auth';
import { integrationsStatusGitHubDisconnected } from '../fixtures/integrations';
import { HEARTBEAT_INTERVAL_MS, useAuthStore } from '../store/authStore';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useSSE } from '../hooks/useSSE';
import { clearSSEListeners } from '../hooks/sseEventBus';
import * as integrationsApi from '../api/integrations';

vi.mock('../hooks/useSessionHeartbeat', () => ({
  useSessionHeartbeat: vi.fn(),
}));

vi.mock('../hooks/useSSE', () => ({
  useSSE: vi.fn(),
}));

vi.mock('./SessionWarningModal', () => ({
  SessionWarningModal: ({ onLogoutComplete }: { onLogoutComplete: () => void }) => (
    <div data-testid="session-warning-modal">
      <button type="button" onClick={onLogoutComplete}>
        Modal logout
      </button>
    </div>
  ),
}));

vi.mock('../api/auth', async () => {
  const actual = await vi.importActual<typeof import('../api/auth')>('../api/auth');
  return {
    ...actual,
    sendHeartbeat: vi.fn().mockResolvedValue({
      session: {
        remainingMs: 86_400_000,
        warning: false,
        expiresAt: '2026-07-10T12:00:00.000Z',
      },
    }),
  };
});

vi.mock('../api/integrations', async () => {
  const actual = await vi.importActual<typeof import('../api/integrations')>(
    '../api/integrations',
  );
  return {
    ...actual,
    fetchIntegrationsStatus: vi.fn().mockResolvedValue({
      github: {
        name: 'github',
        connected: true,
        tokenValid: true,
        connectionState: 'connected',
        lastCheckedAt: '2026-07-14T12:00:00.000Z',
      },
      jira: {
        name: 'jira',
        connected: true,
        tokenValid: true,
        connectionState: 'connected',
        lastCheckedAt: '2026-07-14T12:00:00.000Z',
      },
      checkedAt: '2026-07-14T12:00:00.000Z',
    }),
  };
});

function StubPage({ label }: { label: string }) {
  return (
    <main>
      <h1>{label}</h1>
    </main>
  );
}

function renderProtected(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<StubPage label="Dashboard" />} />
          <Route path="/tickets" element={<StubPage label="Tickets" />} />
          <Route path="/workflows" element={<StubPage label="Workflows" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    clearSSEListeners();
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      showSessionWarning: false,
    });
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
    clearSSEListeners();
  });

  it('renders shared shell for authenticated users', async () => {
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusGitHubDisconnected,
    );
    useAuthStore.getState().setAuth(mockGithubOnlyAuthUser, authenticatedSession);

    renderProtected();

    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByTestId('session-warning-modal')).toBeInTheDocument();
    expect(await screen.findByRole('status')).toHaveTextContent(/GitHub not connected/);
  });

  it('redirects unauthenticated users to /login within 500ms', async () => {
    const started = Date.now();
    renderProtected('/dashboard');

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeInTheDocument();
    });

    expect(Date.now() - started).toBeLessThan(500);
  });

  it('sets up session heartbeat when authenticated', () => {
    useAuthStore.getState().setAuth(mockAuthUser, authenticatedSession);

    renderProtected();

    expect(useSessionHeartbeat).toHaveBeenCalledWith(true);
  });

  it('invokes SSE hook once for authenticated sessions', () => {
    useAuthStore.getState().setAuth(mockAuthUser, authenticatedSession);

    renderProtected();

    expect(useSSE).toHaveBeenCalledTimes(1);
    expect(useSSE).toHaveBeenCalledWith(
      expect.objectContaining({
        enabled: true,
        onEvent: expect.any(Function),
      }),
    );
  });

  it('disables SSE when auth is cleared (logout / session expiry)', async () => {
    useAuthStore.getState().setAuth(mockAuthUser, authenticatedSession);
    renderProtected();

    expect(vi.mocked(useSSE).mock.calls[vi.mocked(useSSE).mock.calls.length - 1]?.[0]?.enabled).toBe(true);

    useAuthStore.getState().clearAuth();

    await waitFor(() => {
      expect(vi.mocked(useSSE).mock.calls[vi.mocked(useSSE).mock.calls.length - 1]?.[0]?.enabled).toBe(false);
    });
  });

  it('keeps a single ProtectedRoute-owned SSE/heartbeat wiring while navigating', () => {
    useAuthStore.getState().setAuth(mockAuthUser, authenticatedSession);

    renderProtected('/dashboard');

    fireEvent.click(screen.getByRole('link', { name: 'Tickets' }));
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Workflows' }));
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();

    const heartbeatArgs = vi.mocked(useSessionHeartbeat).mock.calls.map((call) => call[0]);
    const sseEnabled = vi.mocked(useSSE).mock.calls.map((call) => call[0]?.enabled);

    expect(heartbeatArgs.every((enabled) => enabled === true)).toBe(true);
    expect(sseEnabled.every((enabled) => enabled === true)).toBe(true);
    // Only ProtectedRoute invokes these hooks — never per-page duplicates
    expect(vi.mocked(useSessionHeartbeat).mock.calls.length).toBe(
      vi.mocked(useSSE).mock.calls.length,
    );
  });

  it('exposes session fixtures for authenticated, expiring, and expired states', () => {
    expect(authenticatedSession.remainingMs).toBeGreaterThan(HEARTBEAT_INTERVAL_MS);
    expect(expiringSession.remainingMs).toBeLessThanOrEqual(5 * 60 * 1000);
    expect(expiringSession.warning).toBe(true);
    expect(expiredSession.remainingMs).toBe(0);
  });
});
