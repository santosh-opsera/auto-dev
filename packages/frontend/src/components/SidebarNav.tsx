import { NavLink } from 'react-router-dom';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/tickets', label: 'Tickets' },
  { to: '/workflows', label: 'Workflows' },
  { to: '/repositories', label: 'Repositories' },
  { to: '/conventions', label: 'Conventions' },
  { to: '/integrations', label: 'Integrations' },
] as const;

/**
 * Minimal shared sidebar for WO-013. Full nav UX (icons, collapsible sections,
 * active-state polish) is delivered by WO-017.
 */
export function SidebarNav() {
  return (
    <nav className="sidebar-nav" aria-label="Primary">
      <p className="sidebar-nav-brand">AutoDev</p>
      <ul className="sidebar-nav-list">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'sidebar-nav-link is-active' : 'sidebar-nav-link'
              }
              end={item.to === '/dashboard'}
            >
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
