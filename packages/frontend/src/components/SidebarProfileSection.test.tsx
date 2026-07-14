import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthUser, SessionMetadata } from '../api/auth';
import { useAuthStore } from '../store/authStore';
import { SidebarProfileSection, getInitials } from './SidebarProfileSection';

const user: AuthUser = {
  email: 'ada@example.com',
  displayName: 'Ada Lovelace',
  connectedProviders: ['github', 'atlassian'],
  integrations: { jira: true, githubRepos: false, atlassianEmail: 'ada@atlassian.com' },
};

const session: SessionMetadata = { remainingMs: 12 * 60_000 };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
});

afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, session: null, isAuthenticated: false });
});

describe('getInitials', () => {
  it('derives initials from first and last name', () => {
    expect(getInitials('Ada Lovelace')).toBe('AL');
  });

  it('uses first two characters for a single word', () => {
    expect(getInitials('ada')).toBe('AD');
  });

  it('falls back to a placeholder for empty input', () => {
    expect(getInitials('   ')).toBe('?');
  });
});

describe('SidebarProfileSection', () => {
  beforeEach(() => {
    useAuthStore.setState({ user, session, isAuthenticated: true });
  });

  it('shows avatar initials, display name, and secondary email', () => {
    render(<SidebarProfileSection collapsed={false} />);

    expect(screen.getByText('AL')).toBeInTheDocument();
    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('opens profile details on click without a dialog before interaction', () => {
    render(<SidebarProfileSection collapsed={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open profile details for Ada Lovelace' }));

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByText('Jira integration')).toBeInTheDocument();
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('12 minutes')).toBeInTheDocument();
  });

  it('closes the profile details via the close action', () => {
    render(<SidebarProfileSection collapsed={false} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open profile details for Ada Lovelace' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close profile details' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('exposes a tooltip in collapsed mode', () => {
    render(<SidebarProfileSection collapsed={true} />);

    const trigger = screen.getByRole('button', { name: 'Open profile details for Ada Lovelace' });
    expect(trigger).toHaveAttribute('title', 'Ada Lovelace');
    expect(trigger).toHaveAttribute('data-tooltip', 'Ada Lovelace');
  });

  it('renders a fallback when the user is unavailable', () => {
    useAuthStore.setState({ user: null, session: null, isAuthenticated: false });
    render(<SidebarProfileSection collapsed={false} />);

    expect(screen.getByText('Profile unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
