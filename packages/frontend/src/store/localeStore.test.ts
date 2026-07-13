import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FALLBACK_LOCALE } from '../utils/localeFormat';
import { getAppLocale, useLocaleStore } from './localeStore';

describe('localeStore', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: FALLBACK_LOCALE });
  });

  it('defaults to en-US before detection', () => {
    expect(useLocaleStore.getState().locale).toBe(FALLBACK_LOCALE);
    expect(getAppLocale()).toBe(FALLBACK_LOCALE);
  });

  it('stores browser locale via detectLocale', () => {
    vi.stubGlobal('navigator', { language: 'de-DE' });
    useLocaleStore.getState().detectLocale();
    expect(useLocaleStore.getState().locale).toBe('de-DE');
    vi.unstubAllGlobals();
  });

  it('falls back to en-US when navigator.language is unusable', () => {
    vi.stubGlobal('navigator', { language: '' });
    useLocaleStore.getState().detectLocale();
    expect(useLocaleStore.getState().locale).toBe(FALLBACK_LOCALE);
    vi.unstubAllGlobals();
  });

  it('setLocale resolves unsupported tags to en-US', () => {
    useLocaleStore.getState().setLocale('ja-JP');
    expect(getAppLocale()).toBe('ja-JP');

    useLocaleStore.getState().setLocale('!!!nope!!!');
    expect(getAppLocale()).toBe(FALLBACK_LOCALE);
  });
});
