/** Fallback locale when browser detection fails or Intl rejects the tag. */
export const FALLBACK_LOCALE = 'en-US';

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = {
  dateStyle: 'medium',
  timeStyle: 'short',
};

const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Returns true when `locale` is a non-empty BCP 47 tag accepted by Intl.
 */
export function isSupportedLocale(locale: string | null | undefined): locale is string {
  if (!locale || typeof locale !== 'string' || locale.trim() === '') {
    return false;
  }

  try {
    const canonical = Intl.getCanonicalLocales(locale);
    return canonical.length > 0;
  } catch {
    return false;
  }
}

/**
 * Resolves a locale tag, falling back to en-US when missing or unsupported.
 */
export function resolveLocale(locale?: string | null): string {
  return isSupportedLocale(locale) ? locale : FALLBACK_LOCALE;
}

/**
 * Detects the browser locale via `navigator.language` (or an override for tests).
 * Falls back to en-US when detection fails.
 */
export function detectBrowserLocale(
  language: string | null | undefined = typeof navigator !== 'undefined'
    ? navigator.language
    : undefined,
): string {
  return resolveLocale(language);
}

/**
 * Formats a date/time with Intl.DateTimeFormat for the given locale.
 */
export function formatDate(
  value: string | number | Date,
  locale?: string | null,
  options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS,
): string {
  const resolved = resolveLocale(locale);
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : String(value);
  }

  try {
    return new Intl.DateTimeFormat(resolved, options).format(date);
  } catch {
    return new Intl.DateTimeFormat(FALLBACK_LOCALE, options).format(date);
  }
}

/**
 * Formats a number with Intl.NumberFormat for the given locale.
 */
export function formatNumber(
  value: number,
  locale?: string | null,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) {
    return String(value);
  }

  const resolved = resolveLocale(locale);

  try {
    return new Intl.NumberFormat(resolved, options).format(value);
  } catch {
    return new Intl.NumberFormat(FALLBACK_LOCALE, options).format(value);
  }
}

/**
 * Formats a byte count as a human-readable file size with locale-aware numbers.
 * Uses 1024-based units (B, KB, MB, GB, TB).
 */
export function formatFileSize(bytes: number, locale?: string | null): string {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return formatNumber(0, locale, { maximumFractionDigits: 0 }) + ' B';
  }

  if (bytes === 0) {
    return `${formatNumber(0, locale, { maximumFractionDigits: 0 })} B`;
  }

  let unitIndex = 0;
  let size = bytes;

  while (size >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = unitIndex === 0 ? 0 : 1;
  const formatted = formatNumber(size, locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });

  return `${formatted} ${FILE_SIZE_UNITS[unitIndex]}`;
}
