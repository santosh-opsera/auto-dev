import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NAV_ITEMS, SIDEBAR_COLLAPSE_MQ, SidebarNav } from './SidebarNav';

function mockMatchMedia(matches: boolean) {
  const listeners = new Set<(event: MediaQueryListEvent) => void>();

  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query === SIDEBAR_COLLAPSE_MQ ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn((_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      dispatchEvent: vi.fn(),
    })),
  });

  return {
    setMatches(next: boolean) {
      matches = next;
      const event = { matches: next, media: SIDEBAR_COLLAPSE_MQ } as MediaQueryListEvent;
      listeners.forEach((listener) => listener(event));
    },
  };
}

function renderSidebar(initialPath = '/dashboard') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <div className="protected-layout">
        <SidebarNav />
        <div className="protected-layout-main">
          <Routes>
            {NAV_ITEMS.map((item) => (
              <Route
                key={item.to}
                path={item.to}
                element={<main>{item.label} page</main>}
              />
            ))}
          </Routes>
        </div>
      </div>
    </MemoryRouter>,
  );
}

describe('SidebarNav', () => {
  beforeEach(() => {
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders all primary navigation items', () => {
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const item of NAV_ITEMS) {
      expect(within(nav).getByRole('link', { name: item.label })).toHaveAttribute(
        'href',
        item.to,
      );
    }

    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Dashboard',
      'Repositories',
      'Tickets',
      'Workflows',
      'Conventions',
      'Integrations',
    ]);
  });

  it('highlights the active navigation item', () => {
    renderSidebar('/tickets');

    const tickets = screen.getByRole('link', { name: 'Tickets' });
    const dashboard = screen.getByRole('link', { name: 'Dashboard' });

    expect(tickets).toHaveClass('is-active');
    expect(dashboard).not.toHaveClass('is-active');
  });

  it('collapses to icon-only mode and expands again', () => {
    const { container } = renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    const toggle = screen.getByRole('button', { name: 'Collapse sidebar' });

    expect(nav).toHaveAttribute('data-collapsed', 'false');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(container.querySelector('.protected-layout')).toBeTruthy();

    fireEvent.click(toggle);

    expect(nav).toHaveClass('is-collapsed');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    for (const item of NAV_ITEMS) {
      const link = screen.getByRole('link', { name: item.label });
      expect(link).toHaveAttribute('title', item.label);
      expect(link).toHaveAttribute('data-tooltip', item.label);
    }

    fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));

    expect(nav).not.toHaveClass('is-collapsed');
    expect(nav).toHaveAttribute('data-collapsed', 'false');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('title');
  });

  it('defaults to collapsed mode below 768px', () => {
    mockMatchMedia(true);
    renderSidebar();

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(nav).toHaveClass('is-collapsed');
    expect(nav).toHaveAttribute('data-collapsed', 'true');
    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
