import { create } from 'zustand';
import {
  FALLBACK_LOCALE,
  detectBrowserLocale,
  resolveLocale,
} from '../utils/localeFormat';

interface LocaleState {
  /** Active BCP 47 locale used by formatDate / formatNumber / formatFileSize callers. */
  locale: string;
  /** Detect navigator.language and store it (en-US fallback). */
  detectLocale: () => void;
  /** Override the active locale (resolved with en-US fallback). */
  setLocale: (locale: string | null | undefined) => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: FALLBACK_LOCALE,
  detectLocale: () => {
    set({ locale: detectBrowserLocale() });
  },
  setLocale: (locale) => {
    set({ locale: resolveLocale(locale) });
  },
}));

/** Convenience accessor for non-React helpers (e.g. formatWorkflowTimestamp). */
export function getAppLocale(): string {
  return useLocaleStore.getState().locale;
}
