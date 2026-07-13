/**
 * PII masking for structured logs (WO-036 / REQ-015).
 * Emails → first local char + ***@*** + TLD (e.g. j***@***.com).
 * Names → first letter of each word + *** (e.g. J*** D***).
 */

const EMAIL_PATTERN = /\b([A-Za-z0-9._%+-]+)@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g;

/** Mask a single email address. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    return '***@***.***';
  }

  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const tldDot = domain.lastIndexOf('.');
  const tld = tldDot >= 0 ? domain.slice(tldDot + 1) : 'com';
  const first = local.charAt(0).toLowerCase();
  return `${first}***@***.${tld}`;
}

/** Mask a display name (space-separated words). */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '***';
  }
  return parts.map((part) => `${part.charAt(0).toUpperCase()}***`).join(' ');
}

/**
 * Mask emails and common "First Last" name patterns inside free-form log text.
 * Name masking skips sentence-leading words (e.g. "Contact Jane Doe" → "Contact J*** D***").
 */
export function maskPiiInText(text: string): string {
  const withoutEmails = text.replace(EMAIL_PATTERN, (match) => maskEmail(match));

  // Require a preceding space or "(" so sentence-start words are not treated as names.
  return withoutEmails.replace(
    /(?<=[\s(])([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g,
    (match) => maskName(match),
  );
}
