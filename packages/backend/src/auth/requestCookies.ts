import type { Request } from 'express';

/** Extract a string cookie value from an Express request, if present. */
export function getCookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown> | undefined;
  if (!cookies || typeof cookies !== 'object') {
    return undefined;
  }
  const value = cookies[name];
  return typeof value === 'string' ? value : undefined;
}

export function getClientIp(req: Request): string {
  return req.ip ?? 'unknown';
}
