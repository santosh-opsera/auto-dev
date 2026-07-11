import { describe, expect, it } from 'vitest';
import {
  mockAtlassianTokenResponse,
  mockAtlassianUserResponse,
} from '../../fixtures/auth.js';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import {
  buildAtlassianAuthorizationUrl,
  exchangeAtlassianCode,
  resolveAtlassianRetryPrompt,
} from './atlassianAuthService.js';

describe('atlassianAuthService', () => {
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
});

describe('atlassianAuthService integration fetchers', () => {
  it('has default fetchers configured', async () => {
    const { atlassianAuthInternals } = await import('./atlassianAuthService.js');
    expect(typeof atlassianAuthInternals.defaultTokenFetcher).toBe('function');
    expect(typeof atlassianAuthInternals.defaultUserFetcher).toBe('function');
  });
});
