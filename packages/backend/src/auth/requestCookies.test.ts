import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import {
  OAUTH_LINK_USER_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from './constants.js';
import { mockOAuthCallbackCookieCombos } from '../fixtures/auth.js';
import { getClientIp, getCookieValue } from './requestCookies.js';

function asRequest(cookies: Record<string, unknown>, ip?: string): Request {
  return { cookies, ip } as Request;
}

describe('getCookieValue', () => {
  it('returns string cookie values for all OAuth cookie names', () => {
    const cookies = mockOAuthCallbackCookieCombos.accountLinking;
    const req = asRequest(cookies);

    expect(getCookieValue(req, PKCE_COOKIE_NAME)).toBe('mock-pkce-verifier');
    expect(getCookieValue(req, SESSION_COOKIE_NAME)).toBe('mock-session-id');
    expect(getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME)).toBe('mock-user-id');
  });

  it('returns undefined for missing cookies', () => {
    const req = asRequest(mockOAuthCallbackCookieCombos.empty);
    expect(getCookieValue(req, PKCE_COOKIE_NAME)).toBeUndefined();
    expect(getCookieValue(req, SESSION_COOKIE_NAME)).toBeUndefined();
    expect(getCookieValue(req, OAUTH_LINK_USER_COOKIE_NAME)).toBeUndefined();
  });

  it('returns undefined for non-string cookie values', () => {
    const req = asRequest({ [PKCE_COOKIE_NAME]: 123, [SESSION_COOKIE_NAME]: null });
    expect(getCookieValue(req, PKCE_COOKIE_NAME)).toBeUndefined();
    expect(getCookieValue(req, SESSION_COOKIE_NAME)).toBeUndefined();
  });

  it('returns undefined when cookies object is missing', () => {
    expect(getCookieValue({} as Request, PKCE_COOKIE_NAME)).toBeUndefined();
  });
});

describe('getClientIp', () => {
  it('returns request ip or unknown', () => {
    expect(getClientIp(asRequest({}, '10.0.0.1'))).toBe('10.0.0.1');
    expect(getClientIp(asRequest({}))).toBe('unknown');
  });
});
