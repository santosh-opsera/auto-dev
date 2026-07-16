import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useThemeStore } from '../store/themeStore';
import { LoginPage } from './LoginPage';

afterEach(() => {
  cleanup();
});

describe('LoginPage', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'light' });

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
    const githubButton = screen.getByRole('button', { name: 'Continue with GitHub' });
    expect(githubButton).toBeInTheDocument();
    expect(screen.getByTestId('github-sign-in-icon')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Continue with Atlassian' })).not.toBeInTheDocument();

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/auth/prepare-login'),
        expect.objectContaining({ method: 'GET', credentials: 'include' }),
      );
    });
  });

  it('shows a theme toggle that switches appearance before sign-in', () => {
    render(<LoginPage />);

    const toggle = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(toggle);

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('autodev_theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Switch to light theme' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
