import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { authenticatedSession, mockAuthUser } from '../fixtures/auth';
import { useAuthStore } from '../store/authStore';
import { clearSSEListeners } from '../hooks/sseEventBus';
import { useSSESubscription } from '../hooks/useSSESubscription';

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

vi.mock('./SessionWarningModal', () => ({
  SessionWarningModal: () => <div data-testid="session-warning-modal" />,
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      this.onopen?.();
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  }

  close(): void {
    // no-op
  }
}

function PageWithSubscription({ label }: { label: string }) {
  useSSESubscription(() => undefined);
  return (
    <main>
      <h1>{label}</h1>
    </main>
  );
}

describe('ProtectedRoute integration', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    clearSSEListeners();
    vi.stubGlobal('EventSource', MockEventSource as unknown as typeof EventSource);
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      showSessionWarning: false,
    });
    useAuthStore.getState().setAuth(mockAuthUser, authenticatedSession);
  });

  afterEach(() => {
    cleanup();
    clearSSEListeners();
    MockEventSource.instances = [];
    vi.unstubAllGlobals();
  });

  it('opens a single SSE connection and heartbeat across protected route navigations', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<PageWithSubscription label="Dashboard" />} />
            <Route path="/tickets" element={<PageWithSubscription label="Tickets" />} />
            <Route path="/workflows" element={<PageWithSubscription label="Workflows" />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const heartbeatIntervals = setIntervalSpy.mock.calls.length;

    fireEvent.click(screen.getByRole('link', { name: 'Tickets' }));
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'Workflows' }));
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();

    expect(MockEventSource.instances).toHaveLength(1);
    expect(setIntervalSpy.mock.calls.length).toBe(heartbeatIntervals);

    setIntervalSpy.mockRestore();
  });
});
