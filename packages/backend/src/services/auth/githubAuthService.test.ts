import { describe, expect, it } from 'vitest';
import {
  mockGitHubTokenResponse,
  mockGitHubUserResponse,
} from '../../fixtures/auth.js';
import { exchangeGitHubCode } from './githubAuthService.js';

describe('githubAuthService', () => {
  it('exchanges OAuth code for a normalized profile using mocked GitHub APIs', async () => {
    const profile = await exchangeGitHubCode(
      {
        code: 'mock-code',
        codeVerifier: 'mock-verifier',
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'http://localhost/callback',
      },
      () => Promise.resolve(mockGitHubTokenResponse),
      () => Promise.resolve(mockGitHubUserResponse),
    );

    expect(profile.provider).toBe('github');
    expect(profile.email).toBe('alex.dev@example.com');
    expect(profile.accessToken).toBe('gho_mock_access_token');
    expect(profile.scopes).toContain('read:user');
  });
});

describe('githubAuthService integration fetchers', () => {
  it('has default fetchers configured', async () => {
    const { githubAuthInternals } = await import('./githubAuthService.js');
    expect(typeof githubAuthInternals.defaultTokenFetcher).toBe('function');
    expect(typeof githubAuthInternals.defaultUserFetcher).toBe('function');
  });
});
