import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  mockAuthUser,
  mockGithubOnlyAuthUser,
  mockSessionMetadata,
} from '../fixtures/auth';
import { useAuthStore } from '../store/authStore';
import { RepositoriesPage } from './RepositoriesPage';

const listConnectedRepositories = vi.fn();
const listGitHubRepositories = vi.fn();

vi.mock('../api/repositories', async () => {
  const actual = await vi.importActual<typeof import('../api/repositories')>('../api/repositories');
  return {
    ...actual,
    listConnectedRepositories: (...args: unknown[]) => listConnectedRepositories(...args),
    listGitHubRepositories: (...args: unknown[]) => listGitHubRepositories(...args),
    connectRepository: vi.fn(),
    analyzeRepository: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
});

describe('RepositoriesPage', () => {
  beforeEach(() => {
    useAuthStore.getState().clearAuth();
    listConnectedRepositories.mockResolvedValue({ connections: [] });
    listGitHubRepositories.mockResolvedValue({
      repositories: [
        {
          id: 1,
          name: 'auto-dev',
          fullName: 'santosh-opsera/auto-dev',
          owner: 'santosh-opsera',
          private: false,
          defaultBranch: 'main',
          htmlUrl: 'https://github.com/santosh-opsera/auto-dev',
        },
      ],
      pagination: {
        page: 1,
        perPage: 30,
        totalCount: 45,
        hasNextPage: true,
      },
      rateLimit: {
        limit: 5000,
        remaining: 42,
        resetAt: '2026-07-14T12:30:00.000Z',
        queuedRequests: 0,
      },
      rateLimitWarning:
        'GitHub API rate limit is low (42 of 5000 remaining). Resets in about 15 minutes (2026-07-14T12:30:00.000Z).',
    });
  });

  it('does not auto-load available repos when GitHub repo access is missing', async () => {
    useAuthStore.getState().setAuth(mockGithubOnlyAuthUser, mockSessionMetadata);

    render(
      <MemoryRouter>
        <RepositoriesPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('link', { name: /Connect GitHub repository access/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listConnectedRepositories).toHaveBeenCalled();
    });
    expect(listGitHubRepositories).not.toHaveBeenCalled();
  });

  it('auto-loads available repos and shows a non-blocking rate-limit warning', async () => {
    useAuthStore.getState().setAuth(mockAuthUser, mockSessionMetadata);

    render(
      <MemoryRouter>
        <RepositoriesPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(listGitHubRepositories).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, perPage: 30 }),
      );
    });
    expect(await screen.findByText('santosh-opsera/auto-dev')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /GitHub rate limit warning/i })).toBeInTheDocument();
    expect(screen.getByText(/42 of 5000 remaining/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Load more' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 45 repositories/i)).toBeInTheDocument();
  });

  it('resets to page 1 when a filter is applied', async () => {
    useAuthStore.getState().setAuth(mockAuthUser, mockSessionMetadata);
    listGitHubRepositories
      .mockResolvedValueOnce({
        repositories: [
          {
            id: 1,
            name: 'auto-dev',
            fullName: 'santosh-opsera/auto-dev',
            owner: 'santosh-opsera',
            private: false,
            defaultBranch: 'main',
            htmlUrl: 'https://github.com/santosh-opsera/auto-dev',
          },
        ],
        pagination: { page: 1, perPage: 30, totalCount: 45, hasNextPage: true },
      })
      .mockResolvedValueOnce({
        repositories: [
          {
            id: 2,
            name: 'platform-ui',
            fullName: 'santosh-opsera/platform-ui',
            owner: 'santosh-opsera',
            private: true,
            defaultBranch: 'main',
            htmlUrl: 'https://github.com/santosh-opsera/platform-ui',
          },
        ],
        pagination: { page: 1, perPage: 30, totalCount: 1, hasNextPage: false },
      });

    render(
      <MemoryRouter>
        <RepositoriesPage />
      </MemoryRouter>,
    );

    await screen.findByText('santosh-opsera/auto-dev');
    fireEvent.change(screen.getByLabelText(/Filter repositories/i), {
      target: { value: 'platform' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filter' }));

    await waitFor(() => {
      expect(listGitHubRepositories).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 1, perPage: 30, q: 'platform' }),
      );
    });
    expect(await screen.findByText('santosh-opsera/platform-ui')).toBeInTheDocument();
  });

  it('shows actionable rate-limit error with retry when auto-load is exhausted', async () => {
    const { ApiError } = await import('../api/client');
    listGitHubRepositories.mockRejectedValue(
      new ApiError(
        'GitHub API rate limit exceeded.',
        403,
        undefined,
        'GitHubRateLimited',
        'Rate limit resets around 2026-07-14T12:30:00.000Z (about 20 minutes). Retry after the window opens.',
      ),
    );
    useAuthStore.getState().setAuth(mockAuthUser, mockSessionMetadata);

    render(
      <MemoryRouter>
        <RepositoriesPage />
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: /GitHub rate limit reached/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(screen.getByText(/12:30:00/)).toBeInTheDocument();
  });
});
