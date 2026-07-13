/**
 * Sample dates/numbers with expected Intl outputs for locale-aware formatting tests.
 * Date expectations use UTC so they are stable across host timezones.
 */

export const SAMPLE_ISO_TIMESTAMP = '2026-07-13T14:30:00.000Z';

export const SAMPLE_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
};

export const SAMPLE_NUMBER = 1234.5;
export const SAMPLE_LARGE_NUMBER = 1_234_567.89;

export const SAMPLE_FILE_SIZE_BYTES = 1_234_567;
export const SAMPLE_FILE_SIZE_KB = 1536;
export const SAMPLE_FILE_SIZE_ZERO = 0;

/** Expected formatDate outputs for SAMPLE_ISO_TIMESTAMP with SAMPLE_DATE_OPTIONS. */
export const expectedDateByLocale = {
  'en-US': 'Jul 13, 2026, 2:30 PM',
  'de-DE': '13.07.2026, 14:30',
  'ja-JP': '2026/07/13 14:30',
} as const;

/** Expected formatNumber outputs for SAMPLE_NUMBER. */
export const expectedNumberByLocale = {
  'en-US': '1,234.5',
  'de-DE': '1.234,5',
  'ja-JP': '1,234.5',
} as const;

/** Expected formatNumber outputs for SAMPLE_LARGE_NUMBER. */
export const expectedLargeNumberByLocale = {
  'en-US': '1,234,567.89',
  'de-DE': '1.234.567,89',
  'ja-JP': '1,234,567.89',
} as const;

/** Expected formatFileSize outputs for SAMPLE_FILE_SIZE_BYTES (~1.2 MB). */
export const expectedFileSizeByLocale = {
  'en-US': '1.2 MB',
  'de-DE': '1,2 MB',
  'ja-JP': '1.2 MB',
} as const;

/** Expected formatFileSize outputs for SAMPLE_FILE_SIZE_KB (1.5 KB). */
export const expectedFileSizeKbByLocale = {
  'en-US': '1.5 KB',
  'de-DE': '1,5 KB',
  'ja-JP': '1.5 KB',
} as const;

export const expectedZeroFileSizeByLocale = {
  'en-US': '0 B',
  'de-DE': '0 B',
  'ja-JP': '0 B',
} as const;

export const LOCALE_SAMPLES = ['en-US', 'de-DE', 'ja-JP'] as const;

export type SampleLocale = (typeof LOCALE_SAMPLES)[number];
