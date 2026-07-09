import { describe, expect, it } from 'vitest';
import {
  mockAtlassianTokenResponse,
  mockAtlassianUserResponse,
} from '../../fixtures/auth.js';
import { exchangeAtlassianCode } from './atlassianAuthService.js';

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
    expect(profile.scopes).toContain('read:jira-work');
  });
});

describe('atlassianAuthService integration fetchers', () => {
  it('has default fetchers configured', async () => {
    const { atlassianAuthInternals } = await import('./atlassianAuthService.js');
    expect(typeof atlassianAuthInternals.defaultTokenFetcher).toBe('function');
    expect(typeof atlassianAuthInternals.defaultUserFetcher).toBe('function');
  });
});
