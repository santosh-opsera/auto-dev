import { describe, expect, it } from 'vitest';
import {
  SAMPLE_DATE_OPTIONS,
  SAMPLE_FILE_SIZE_BYTES,
  SAMPLE_FILE_SIZE_KB,
  SAMPLE_FILE_SIZE_ZERO,
  SAMPLE_ISO_TIMESTAMP,
  SAMPLE_LARGE_NUMBER,
  SAMPLE_NUMBER,
  expectedDateByLocale,
  expectedFileSizeByLocale,
  expectedFileSizeKbByLocale,
  expectedLargeNumberByLocale,
  expectedNumberByLocale,
  expectedZeroFileSizeByLocale,
  LOCALE_SAMPLES,
} from '../fixtures/localeFormat';
import {
  FALLBACK_LOCALE,
  detectBrowserLocale,
  formatDate,
  formatFileSize,
  formatNumber,
  isSupportedLocale,
  resolveLocale,
} from './localeFormat';

describe('detectBrowserLocale / resolveLocale', () => {
  it('returns navigator language when supported', () => {
    expect(detectBrowserLocale('de-DE')).toBe('de-DE');
    expect(detectBrowserLocale('ja-JP')).toBe('ja-JP');
    expect(detectBrowserLocale('en-US')).toBe('en-US');
  });

  it('falls back to en-US when detection fails', () => {
    expect(detectBrowserLocale(undefined)).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale(null)).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale('')).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale('   ')).toBe(FALLBACK_LOCALE);
    expect(detectBrowserLocale('not-a-real-locale-tag!!!')).toBe(FALLBACK_LOCALE);
  });

  it('resolveLocale falls back for unsupported tags', () => {
    expect(resolveLocale('en-GB')).toBe('en-GB');
    expect(resolveLocale(undefined)).toBe(FALLBACK_LOCALE);
    expect(isSupportedLocale('en-US')).toBe(true);
    expect(isSupportedLocale('')).toBe(false);
  });
});

describe('formatDate', () => {
  it.each(LOCALE_SAMPLES)('formats sample timestamp for %s', (locale) => {
    expect(formatDate(SAMPLE_ISO_TIMESTAMP, locale, SAMPLE_DATE_OPTIONS)).toBe(
      expectedDateByLocale[locale],
    );
  });

  it('falls back to en-US formatting when locale is invalid', () => {
    expect(formatDate(SAMPLE_ISO_TIMESTAMP, '!!!invalid!!!', SAMPLE_DATE_OPTIONS)).toBe(
      expectedDateByLocale['en-US'],
    );
  });

  it('returns the original string for invalid dates', () => {
    expect(formatDate('not-a-date', 'en-US')).toBe('not-a-date');
  });
});

describe('formatNumber', () => {
  it.each(LOCALE_SAMPLES)('formats sample number for %s', (locale) => {
    expect(formatNumber(SAMPLE_NUMBER, locale)).toBe(expectedNumberByLocale[locale]);
  });

  it.each(LOCALE_SAMPLES)('formats large number for %s', (locale) => {
    expect(formatNumber(SAMPLE_LARGE_NUMBER, locale)).toBe(expectedLargeNumberByLocale[locale]);
  });

  it('falls back to en-US when locale detection fails', () => {
    expect(formatNumber(SAMPLE_NUMBER, null)).toBe(expectedNumberByLocale['en-US']);
    expect(formatNumber(SAMPLE_NUMBER, '!!!bad!!!')).toBe(expectedNumberByLocale['en-US']);
  });
});

describe('formatFileSize', () => {
  it.each(LOCALE_SAMPLES)('formats MB size for %s', (locale) => {
    expect(formatFileSize(SAMPLE_FILE_SIZE_BYTES, locale)).toBe(expectedFileSizeByLocale[locale]);
  });

  it.each(LOCALE_SAMPLES)('formats KB size for %s', (locale) => {
    expect(formatFileSize(SAMPLE_FILE_SIZE_KB, locale)).toBe(expectedFileSizeKbByLocale[locale]);
  });

  it.each(LOCALE_SAMPLES)('formats zero bytes for %s', (locale) => {
    expect(formatFileSize(SAMPLE_FILE_SIZE_ZERO, locale)).toBe(expectedZeroFileSizeByLocale[locale]);
  });

  it('falls back to en-US file size formatting', () => {
    expect(formatFileSize(SAMPLE_FILE_SIZE_BYTES, undefined)).toBe(
      expectedFileSizeByLocale['en-US'],
    );
  });
});
