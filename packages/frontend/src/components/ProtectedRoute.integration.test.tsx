import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { authenticatedSession, mockAuthUser } from '../fixtures/auth';
import { domainEventFixtures } from '../fixtures/sseEvents';
import { useAuthStore } from '../store/authStore';
import { clearSSEListeners } from '../hooks/sseEventBus';
import { useSSESubscription } from '../hooks/useSSESubscription';
import * as authApi from '../api/auth';

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
    logout: vi.fn().mockResolvedValue(undefined),
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

vi.mock('./SessionWarningModal', () => ({
  SessionWarningModal: ({ onLogoutComplete }: { onLogoutComplete: () => void }) => (
    <div data-testid="session-warning-modal">
      <button
        type="button"
        onClick={() => {
          useAuthStore.getState().clearAuth();
          onLogoutComplete();
        }}
      >
        Modal logout
      </button>
    </div>
  ),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  listeners = new Map<string, Array<(event: MessageEvent<string>) => void>>();
  closed = false;

  constructor(public readonly url: string) {
    MockEventSource.instances.push(this);
    queueMicrotask(() => {
      if (!this.closed) {
        this.onopen?.();
      }
    });
  }

  addEventListener(type: string, listener: (event: MessageEvent<string>) => void): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(listener);
    this.listeners.set(type, handlers);
  }

  close(): void {
    this.closed = true;
    this.onopen = null;
    this.onmessage = null;
    this.onerror = null;
    this.listeners.clear();
  }

  emit(type: string, data: string): void {
    if (this.closed) {
      return;
    }

    const event = { data } as MessageEvent<string>;
    if (type === 'message') {
      this.onmessage?.(event);
      return;
    }

    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  emitError(): void {
    if (this.closed) {
      return;
    }
    this.onerror?.();
  }
}

function PageWithSubscription({
  label,
  onEvent,
}: {
  label: string;
  onEvent: (event: unknown) => void;
}) {
  useSSESubscription(onEvent);
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
    vi.useRealTimers();
  });

  it('opens a single SSE connection and heartbeat across protected route navigations', async () => {
    const setIntervalSpy = vi.spyOn(window, 'setInterval');

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<PageWithSubscription label="Dashboard" onEvent={() => undefined} />} />
            <Route path="/tickets" element={<PageWithSubscription label="Tickets" onEvent={() => undefined} />} />
            <Route path="/workflows" element={<PageWithSubscription label="Workflows" onEvent={() => undefined} />} />
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
    expect(MockEventSource.instances[0]?.closed).toBe(false);
    expect(setIntervalSpy.mock.calls.length).toBe(heartbeatIntervals);

    setIntervalSpy.mockRestore();
  });

  it('delivers DomainEvent SSE payloads across navigation without reconnecting', async () => {
    const received: string[] = [];
    const onEvent = (event: unknown) => {
      const typed = event as { type?: string };
      if (typed.type) {
        received.push(typed.type);
      }
    };

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<PageWithSubscription label="Dashboard" onEvent={onEvent} />} />
            <Route path="/tickets" element={<PageWithSubscription label="Tickets" onEvent={onEvent} />} />
            <Route path="/workflows" element={<PageWithSubscription label="Workflows" onEvent={onEvent} />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const source = MockEventSource.instances[0]!;

    source.emit(
      domainEventFixtures.ticketParsed.type,
      JSON.stringify(domainEventFixtures.ticketParsed),
    );
    expect(received).toEqual([domainEventFixtures.ticketParsed.type]);

    fireEvent.click(screen.getByRole('link', { name: 'Tickets' }));
    expect(screen.getByRole('heading', { name: 'Tickets' })).toBeInTheDocument();
    expect(MockEventSource.instances).toHaveLength(1);
    expect(source.closed).toBe(false);

    source.emit(
      domainEventFixtures.chunkProgress.type,
      JSON.stringify(domainEventFixtures.chunkProgress),
    );

    fireEvent.click(screen.getByRole('link', { name: 'Workflows' }));
    expect(screen.getByRole('heading', { name: 'Workflows' })).toBeInTheDocument();

    source.emit(
      domainEventFixtures.workflowTransitioned.type,
      JSON.stringify(domainEventFixtures.workflowTransitioned),
    );

    expect(MockEventSource.instances).toHaveLength(1);
    expect(source.closed).toBe(false);
    expect(received).toEqual([
      domainEventFixtures.ticketParsed.type,
      domainEventFixtures.chunkProgress.type,
      domainEventFixtures.workflowTransitioned.type,
    ]);
  });

  it('closes the SSE connection immediately on logout with no reconnect attempts', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<PageWithSubscription label="Dashboard" onEvent={() => undefined} />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await vi.waitFor(() => {
      expect(MockEventSource.instances).toHaveLength(1);
    });

    const source = MockEventSource.instances[0]!;
    fireEvent.click(screen.getByRole('button', { name: 'Modal logout' }));

    await vi.waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeInTheDocument();
    });

    expect(source.closed).toBe(true);

    source.emitError();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it('closes SSE and redirects to login when heartbeat signals session expiry', async () => {
    vi.mocked(authApi.sendHeartbeat).mockRejectedValueOnce(new Error('SessionExpired'));

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/login" element={<h1>Sign in to AutoDev</h1>} />
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<PageWithSubscription label="Dashboard" onEvent={() => undefined} />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBeGreaterThanOrEqual(1);
    });

    const source = MockEventSource.instances[0]!;

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeInTheDocument();
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(source.closed).toBe(true);
  });
});
