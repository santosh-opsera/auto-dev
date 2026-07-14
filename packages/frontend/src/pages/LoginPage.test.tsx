import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
      }),
    );
  });

  it('renders only the Continue with GitHub button', async () => {
    render(<LoginPage />);

    expect(screen.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with GitHub' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with Atlassian' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/prepare-login'),
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });
});
