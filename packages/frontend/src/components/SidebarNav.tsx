import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { SidebarProfileSection } from './SidebarProfileSection';

export const SIDEBAR_COLLAPSE_MQ = '(max-width: 767px)';

export const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: 'home' },
  { to: '/repositories', label: 'Repositories', icon: 'repos' },
  { to: '/tickets', label: 'Tickets', icon: 'tickets' },
  { to: '/workflows', label: 'Workflows', icon: 'workflows' },
  { to: '/conventions', label: 'Conventions', icon: 'conventions' },
  { to: '/integrations', label: 'Integrations', icon: 'integrations' },
] as const;

type NavIcon = (typeof NAV_ITEMS)[number]['icon'];

function NavItemIcon({ name }: { name: NavIcon }) {
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  const paths: Record<NavIcon, ReactNode> = {
    home: (
      <>
        <path d="M3 10.5 12 3l9 7.5" />
        <path d="M5 9.5V21h14V9.5" />
      </>
    ),
    repos: (
      <>
        <path d="M7 4h10v16H7z" />
        <path d="M10 8h4M10 12h4M10 16h2" />
      </>
    ),
    tickets: (
      <>
        <path d="M4 7h16v3a2.5 2.5 0 0 0 0 5v3H4v-3a2.5 2.5 0 0 0 0-5V7z" />
        <path d="M12 7v12" />
      </>
    ),
    workflows: (
      <>
        <circle cx="6" cy="6" r="2.25" />
        <circle cx="18" cy="12" r="2.25" />
        <circle cx="6" cy="18" r="2.25" />
        <path d="M8.2 7.2 15.8 11.1M8.2 16.8 15.8 12.9" />
      </>
    ),
    conventions: (
      <>
        <path d="M7 4h10v16H7z" />
        <path d="M9.5 8h5M9.5 12h5M9.5 16h3" />
      </>
    ),
    integrations: (
      <>
        <path d="M8 8h3v3H8zM13 13h3v3h-3z" />
        <path d="M11 9.5h2.5V12M13 14.5H10.5V12" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}

function getPreferredCollapsed(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(SIDEBAR_COLLAPSE_MQ).matches;
}

/**
 * Shared authenticated-app sidebar (WO-017): icon nav, collapse toggle,
 * active highlight, and responsive default for narrow viewports.
 */
export function SidebarNav() {
  const [collapsed, setCollapsed] = useState(getPreferredCollapsed);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') {
      return;
    }
    const media = window.matchMedia(SIDEBAR_COLLAPSE_MQ);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setCollapsed(true);
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => !prev);
  };

  return (
    <nav
      id="sidebar-nav-primary"
      className={collapsed ? 'sidebar-nav is-collapsed' : 'sidebar-nav'}
      aria-label="Primary"
      data-collapsed={collapsed ? 'true' : 'false'}
    >
      <div className="sidebar-nav-header">
        <p className="sidebar-nav-brand">{collapsed ? 'AD' : 'AutoDev'}</p>
        <button
          type="button"
          className="sidebar-nav-toggle"
          aria-expanded={!collapsed}
          aria-controls="sidebar-nav-primary"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={toggleCollapsed}
        >
          <span aria-hidden="true">{collapsed ? '»' : '«'}</span>
        </button>
      </div>
      <ul className="sidebar-nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'sidebar-nav-link is-active' : 'sidebar-nav-link'
              }
              end={item.to === '/dashboard'}
              title={collapsed ? item.label : undefined}
              data-tooltip={item.label}
            >
              <span className="sidebar-nav-icon">
                <NavItemIcon name={item.icon} />
              </span>
              <span className="sidebar-nav-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
      <SidebarProfileSection collapsed={collapsed} />
    </nav>
  );
}
