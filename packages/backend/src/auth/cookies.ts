import type { CookieOptions, Response } from 'express';
import {
  ATLASSIAN_REMEMBER_COOKIE_NAME,
  ATLASSIAN_REMEMBER_MS,
  OAUTH_LINK_USER_COOKIE_NAME,
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

function getLaxCookieOptions(maxAgeMs: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Lax allows OAuth provider redirect-back (top-level GET).
    sameSite: 'lax',
    maxAge: maxAgeMs,
    path: '/',
  };
}

export function setPkceCookie(res: Response, codeVerifier: string): void {
  res.cookie(PKCE_COOKIE_NAME, codeVerifier, getLaxCookieOptions(10 * 60 * 1000));
}

export function clearPkceCookie(res: Response): void {
  res.clearCookie(PKCE_COOKIE_NAME, getLaxCookieOptions(10 * 60 * 1000));
}

export function setAtlassianRememberCookie(res: Response, userId: string): void {
  res.cookie(ATLASSIAN_REMEMBER_COOKIE_NAME, userId, getLaxCookieOptions(ATLASSIAN_REMEMBER_MS));
}

export function clearAtlassianRememberCookie(res: Response): void {
  res.clearCookie(ATLASSIAN_REMEMBER_COOKIE_NAME, getLaxCookieOptions(ATLASSIAN_REMEMBER_MS));
}

const OAUTH_LINK_USER_MAX_AGE_MS = 10 * 60 * 1000;

export function setOAuthLinkUserCookie(res: Response, userId: string): void {
  res.cookie(OAUTH_LINK_USER_COOKIE_NAME, userId, getLaxCookieOptions(OAUTH_LINK_USER_MAX_AGE_MS));
}

export function clearOAuthLinkUserCookie(res: Response): void {
  res.clearCookie(OAUTH_LINK_USER_COOKIE_NAME, getLaxCookieOptions(OAUTH_LINK_USER_MAX_AGE_MS));
}
