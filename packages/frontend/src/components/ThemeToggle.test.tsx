import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useThemeStore } from '../store/themeStore';
import { ThemeToggle } from './ThemeToggle';

afterEach(() => {
  cleanup();
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    useThemeStore.setState({ theme: 'light' });
  });

  it('reflects the light theme and switches to dark on click', () => {
    render(<ThemeToggle collapsed={false} />);

    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('Light')).toBeInTheDocument();

    fireEvent.click(button);

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    const pressed = screen.getByRole('button', { name: 'Switch to light theme' });
    expect(pressed).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Dark')).toBeInTheDocument();
  });

  it('exposes a tooltip label when collapsed', () => {
    render(<ThemeToggle collapsed={true} />);

    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(button).toHaveAttribute('title', 'Switch to dark theme');
    expect(button).toHaveAttribute('data-tooltip', 'Switch to dark theme');
  });

  it('omits the title attribute when expanded', () => {
    render(<ThemeToggle collapsed={false} />);

    const button = screen.getByRole('button', { name: 'Switch to dark theme' });
    expect(button).not.toHaveAttribute('title');
  });
});
