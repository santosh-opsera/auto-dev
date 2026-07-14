import { create } from 'zustand';

export type Theme = 'light' | 'dark';

/** localStorage key holding the user's explicit theme choice. */
export const THEME_STORAGE_KEY = 'autodev_theme';

/** Resolve the OS-level colour preference (light when unknown/unsupported). */
export function getSystemTheme(): Theme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Read a previously saved choice, ignoring unusable/absent values. */
export function readStoredTheme(): Theme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    return raw === 'light' || raw === 'dark' ? raw : null;
  } catch {
    return null;
  }
}

function persistTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Ignore write failures (private mode / quota) — theme still applies in-memory.
  }
}

/** Apply the theme to the document root so CSS custom properties switch. */
export function applyTheme(theme: Theme): void {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

/** Saved choice when present, otherwise the OS default. */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? getSystemTheme();
}

interface ThemeState {
  /** Active theme applied via `data-theme` on `<html>`. */
  theme: Theme;
  /** Sync the store + document with the saved choice or OS default. */
  initTheme: () => void;
  /** Set and persist an explicit theme. */
  setTheme: (theme: Theme) => void;
  /** Flip between light and dark, persisting the new choice. */
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: resolveInitialTheme(),
  initTheme: () => {
    const theme = resolveInitialTheme();
    applyTheme(theme);
    set({ theme });
  },
  setTheme: (theme) => {
    persistTheme(theme);
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark';
    persistTheme(next);
    applyTheme(next);
    set({ theme: next });
  },
}));

/** Convenience accessor for non-React callers. */
export function getAppTheme(): Theme {
  return useThemeStore.getState().theme;
}
