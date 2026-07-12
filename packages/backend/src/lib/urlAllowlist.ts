import { AppError } from '../utils/errors.js';

const DEFAULT_ALLOWED_HOSTS = [
  'auth.atlassian.com',
  'api.atlassian.com',
  'github.com',
  'api.github.com',
  'api.openai.com',
  'api.anthropic.com',
];

function parseAllowedHosts(): string[] {
  const configured = process.env.SSRF_ALLOWED_HOSTS?.trim();
  if (!configured) {
    return DEFAULT_ALLOWED_HOSTS;
  }

  return configured
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowedUrl(url: string, allowedHosts = parseAllowedHosts()): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  return allowedHosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
}

export function assertAllowedUrl(url: string, allowedHosts?: string[]): void {
  if (!isAllowedUrl(url, allowedHosts)) {
    throw new AppError(
      'ForbiddenUrl',
      'The requested URL is not allowed.',
      403,
      'Use an approved external domain for server-side requests.',
    );
  }
}
