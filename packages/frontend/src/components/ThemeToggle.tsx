import { useThemeStore } from '../store/themeStore';

interface ThemeToggleProps {
  collapsed: boolean;
}

/**
 * Light/Dark switcher pinned in the sidebar footer (STL-3). Reachable on every
 * authenticated page and usable when the sidebar is collapsed (tooltip mode).
 */
export function ThemeToggle({ collapsed }: ThemeToggleProps) {
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);
  const isDark = theme === 'dark';
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      className="sidebar-theme-toggle"
      onClick={toggleTheme}
      title={collapsed ? label : undefined}
      data-tooltip={label}
      aria-label={label}
      aria-pressed={isDark}
    >
      <span className="sidebar-theme-toggle-icon" aria-hidden="true">
        {isDark ? (
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
          </svg>
        ) : (
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        )}
      </span>
      <span className="sidebar-theme-toggle-label">{isDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
