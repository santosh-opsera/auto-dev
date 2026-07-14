import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  mockGithubOnlyAuthUser,
  mockAuthUserWithJira,
  mockSessionMetadata,
} from '../fixtures/auth';
import { useAuthStore } from '../store/authStore';
import { IntegrationsPage } from './IntegrationsPage';

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe('IntegrationsPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('shows Connect Jira when the user has no Atlassian provider', () => {
    useAuthStore.getState().setAuth(mockGithubOnlyAuthUser, mockSessionMetadata);

    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Integrations' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Connect Jira' })).toBeInTheDocument();
    expect(screen.queryByText(/Status:\s*Active/i)).not.toBeInTheDocument();
  });

  it('shows active Jira status with Atlassian account email when connected', () => {
    useAuthStore.getState().setAuth(mockAuthUserWithJira, mockSessionMetadata);

    render(
      <MemoryRouter>
        <IntegrationsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('alex.jira@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Atlassian account:/)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Connect Jira' })).not.toBeInTheDocument();
    const jiraSection = screen.getByRole('heading', { name: 'Jira' }).closest('section');
    expect(jiraSection).toHaveTextContent(/Status:\s*Active/);
  });
});
