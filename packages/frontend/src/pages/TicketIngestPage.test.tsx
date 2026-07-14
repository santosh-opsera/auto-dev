import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockGithubOnlyAuthUser,
  mockAuthUserWithJira,
  mockSessionMetadata,
} from '../fixtures/auth';
import { useAuthStore } from '../store/authStore';
import { TicketIngestPage } from './TicketIngestPage';

vi.mock('../hooks/useSessionHeartbeat', () => ({
  useSessionHeartbeat: vi.fn(),
}));

vi.mock('../hooks/useSSE', () => ({
  useSSE: vi.fn(),
}));

vi.mock('../hooks/useTicketIngestion', () => ({
  useTicketIngestion: () => ({
    phase: 'idle',
    ticketKey: null,
    ticket: null,
    error: null,
    errorCode: null,
    progressMessage: null,
    displayIntent: null,
    displayGaps: [],
    canProceed: false,
    ingestTicket: vi.fn(),
    retry: vi.fn(),
    reset: vi.fn(),
    handleSseProgress: vi.fn(),
    resolveGap: vi.fn(),
  }),
}));

vi.mock('../components/SessionWarningModal', () => ({
  SessionWarningModal: () => null,
}));

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe('TicketIngestPage Connect Jira prompt', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('renders Connect Jira when connectedProviders does not include atlassian', () => {
    useAuthStore.getState().setAuth(mockGithubOnlyAuthUser, mockSessionMetadata);

    render(
      <MemoryRouter>
        <TicketIngestPage onLogoutComplete={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Jira access required' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect Jira' })).toBeInTheDocument();
    expect(mockGithubOnlyAuthUser.connectedProviders).not.toContain('atlassian');
  });

  it('hides Connect Jira prompt when Jira is connected', () => {
    useAuthStore.getState().setAuth(mockAuthUserWithJira, mockSessionMetadata);

    render(
      <MemoryRouter>
        <TicketIngestPage onLogoutComplete={() => undefined} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('heading', { name: 'Jira access required' })).not.toBeInTheDocument();
    expect(mockAuthUserWithJira.connectedProviders).toContain('atlassian');
  });
});
