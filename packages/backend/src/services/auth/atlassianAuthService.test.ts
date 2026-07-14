import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  mockAtlassianTokenResponse,
  mockAtlassianUserResponse,
  mockAtlassianRefreshSuccessResponse,
  mockAtlassianRefreshFailureResponse,
} from '../../fixtures/auth.js';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { AppError } from '../../utils/errors.js';
import {
  buildAtlassianAuthorizationUrl,
  exchangeAtlassianCode,
  refreshAtlassianAccessToken,
  resolveAtlassianRetryPrompt,
} from './atlassianAuthService.js';

describe('atlassianAuthService', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('exchanges OAuth code for a normalized profile using mocked Atlassian APIs', async () => {
    const profile = await exchangeAtlassianCode(
      {
        code: 'mock-code',
        codeVerifier: 'mock-verifier',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
      },
      () => Promise.resolve(mockAtlassianTokenResponse),
      () => Promise.resolve(mockAtlassianUserResponse),
    );

    expect(profile.provider).toBe('atlassian');
    expect(profile.email).toBe('alex.dev@example.com');
    expect(profile.accessToken).toBe('atlassian_mock_access_token');
    expect(profile.scopes).toContain('read:me');
  });

  it('defaults to prompt=login with identity-only scopes (no Jira site consent)', () => {
    const url = buildAtlassianAuthorizationUrl(
      'client-id',
      'http://localhost/callback',
      'challenge',
      'state',
    );
    expect(url).toContain('prompt=login');
    expect(url).toContain('read%3Ame');
    expect(url).toContain('offline_access');
    expect(url).not.toContain('read%3Ajira-work');
    expect(resolveAtlassianRetryPrompt('consent_required')).toBe('consent');
    expect(resolveAtlassianRetryPrompt('login_required')).toBe('login');
    expect(resolveAtlassianRetryPrompt('unknown')).toBeNull();
  });

  it('uses SSRF-allowlisted URLs for outbound Atlassian API requests', () => {
    expect(() =>
      assertAllowedUrl('https://auth.atlassian.com/oauth/token'),
    ).not.toThrow();
    expect(() => assertAllowedUrl('https://api.atlassian.com/me')).not.toThrow();
  });

  it('refreshes an access token successfully', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockAtlassianRefreshSuccessResponse,
      }),
    );

    const refreshed = await refreshAtlassianAccessToken({
      refreshToken: 'refresh-token',
      clientId: 'client-id',
      clientSecret: 'client-secret',
    });

    expect(refreshed.access_token).toBe(mockAtlassianRefreshSuccessResponse.access_token);
    expect(refreshed.refresh_token).toBe(mockAtlassianRefreshSuccessResponse.refresh_token);
  });

  it('throws AtlassianReauthorizeRequired when refresh token is revoked', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => mockAtlassianRefreshFailureResponse,
      }),
    );

    await expect(
      refreshAtlassianAccessToken({
        refreshToken: 'revoked-refresh-token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        error: 'AtlassianReauthorizeRequired',
        statusCode: 401,
      }),
    );

    await expect(
      refreshAtlassianAccessToken({
        refreshToken: 'revoked-refresh-token',
        clientId: 'client-id',
        clientSecret: 'client-secret',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('atlassianAuthService integration fetchers', () => {
  it('has default fetchers configured', async () => {
    const { atlassianAuthInternals } = await import('./atlassianAuthService.js');
    expect(typeof atlassianAuthInternals.defaultTokenFetcher).toBe('function');
    expect(typeof atlassianAuthInternals.defaultUserFetcher).toBe('function');
  });
});
