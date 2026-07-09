import type { CookieOptions, Response } from 'express';
import {
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  SESSION_IDLE_MS,
} from './constants.js';

export function getSessionCookieOptions(maxAgeMs = SESSION_IDLE_MS): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function setSessionCookie(res: Response, sessionId: string): void {
  res.cookie(SESSION_COOKIE_NAME, sessionId, getSessionCookieOptions());
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, getSessionCookieOptions());
}

export function setPkceCookie(res: Response, codeVerifier: string): void {
  res.cookie(PKCE_COOKIE_NAME, codeVerifier, {
    ...getSessionCookieOptions(10 * 60 * 1000),
  });
}

export function clearPkceCookie(res: Response): void {
  res.clearCookie(PKCE_COOKIE_NAME, getSessionCookieOptions());
}
