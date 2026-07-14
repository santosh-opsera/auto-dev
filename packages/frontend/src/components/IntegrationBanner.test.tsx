import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrationBanner } from './IntegrationBanner';
import * as integrationsApi from '../api/integrations';
import {
  integrationsStatusAllHealthy,
  integrationsStatusGitHubDisconnected,
  integrationsStatusJiraExpired,
} from '../fixtures/integrations';

vi.mock('../api/integrations', async () => {
  const actual = await vi.importActual<typeof import('../api/integrations')>('../api/integrations');
  return {
    ...actual,
    fetchIntegrationsStatus: vi.fn(),
  };
});

describe('IntegrationBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    sessionStorage.clear();
  });

  it('renders nothing when all integrations are healthy', async () => {
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusAllHealthy,
    );

    const { container } = render(<IntegrationBanner />);

    await waitFor(() => {
      expect(integrationsApi.fetchIntegrationsStatus).toHaveBeenCalled();
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('shows GitHub not connected with repos connect link', async () => {
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusGitHubDisconnected,
    );

    render(<IntegrationBanner />);

    expect(await screen.findByText(/GitHub not connected/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Connect GitHub repositories/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('/api/v1/auth/github/repos/connect'));
  });

  it('shows Jira connection expired with reconnect link', async () => {
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusJiraExpired,
    );

    render(<IntegrationBanner />);

    expect(await screen.findByText(/Jira connection expired — Reconnect/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Reconnect Jira/i });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('/api/v1/auth/atlassian/jira/connect'),
    );
  });

  it('dismisses the banner for the session until status changes', async () => {
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusGitHubDisconnected,
    );

    const { rerender } = render(<IntegrationBanner />);

    expect(await screen.findByText(/GitHub not connected/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Dismiss integration banner/i }));

    await waitFor(() => {
      expect(screen.queryByText(/GitHub not connected/i)).not.toBeInTheDocument();
    });

    rerender(<IntegrationBanner />);

    await waitFor(() => {
      expect(integrationsApi.fetchIntegrationsStatus).toHaveBeenCalled();
    });
    expect(screen.queryByText(/GitHub not connected/i)).not.toBeInTheDocument();

    // Status change clears dismiss and shows the new issue.
    vi.mocked(integrationsApi.fetchIntegrationsStatus).mockResolvedValue(
      integrationsStatusJiraExpired,
    );
    rerender(<IntegrationBanner />);

    // Remount to re-run effect (fingerprint differs).
    cleanup();
    render(<IntegrationBanner />);

    expect(await screen.findByText(/Jira connection expired — Reconnect/i)).toBeInTheDocument();
  });
});
