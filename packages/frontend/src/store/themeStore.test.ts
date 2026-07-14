import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  getAppTheme,
  getSystemTheme,
  readStoredTheme,
  resolveInitialTheme,
  useThemeStore,
} from './themeStore';

function stubMatchMedia(prefersDark: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('dark') ? prefersDark : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

describe('themeStore', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    // jsdom has no matchMedia by default; ensure a clean slate per test.
    (window as { matchMedia?: unknown }).matchMedia = undefined;
    useThemeStore.setState({ theme: 'light' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reads a valid stored theme and ignores unusable values', () => {
    expect(readStoredTheme()).toBeNull();

    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');

    localStorage.setItem(THEME_STORAGE_KEY, 'purple');
    expect(readStoredTheme()).toBeNull();
  });

  it('falls back to light when matchMedia is unavailable', () => {
    expect(getSystemTheme()).toBe('light');
  });

  it('follows the OS preference on first visit', () => {
    stubMatchMedia(true);
    expect(getSystemTheme()).toBe('dark');
    expect(resolveInitialTheme()).toBe('dark');
  });

  it('prefers a saved choice over the OS default', () => {
    stubMatchMedia(true);
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    expect(resolveInitialTheme()).toBe('light');
  });

  it('setTheme persists the choice and applies data-theme', () => {
    useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(getAppTheme()).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('toggleTheme flips between light and dark and persists', () => {
    useThemeStore.setState({ theme: 'light' });

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('initTheme syncs the document with the resolved theme', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    useThemeStore.getState().initTheme();

    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('applyTheme sets the attribute on the document root', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
