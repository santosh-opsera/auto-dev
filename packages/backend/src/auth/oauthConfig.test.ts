import { afterEach, describe, expect, it } from 'vitest';
import {
  createOAuthConfig,
  getAtlassianConfig,
  getGitHubConfig,
} from './oauthConfig.js';

describe('createOAuthConfig', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('reads env vars and returns a typed config object', () => {
    process.env.NODE_ENV = 'development';
    process.env.TEST_CLIENT_ID = 'env-client-id';
    process.env.TEST_CLIENT_SECRET = 'env-client-secret';
    process.env.TEST_REDIRECT_URI = 'https://example.com/callback';
    process.env.FRONTEND_URL = 'https://app.example.com';

    const config = createOAuthConfig({
      clientIdEnv: 'TEST_CLIENT_ID',
      clientSecretEnv: 'TEST_CLIENT_SECRET',
      redirectUriEnv: 'TEST_REDIRECT_URI',
      defaults: {
        clientId: 'default-id',
        clientSecret: 'default-secret',
        redirectUri: 'http://localhost/callback',
      },
    });

    expect(config).toEqual({
      clientId: 'env-client-id',
      clientSecret: 'env-client-secret',
      redirectUri: 'https://example.com/callback',
      frontendUrl: 'https://app.example.com',
    });
  });

  it('throws outside test when client credentials are unset', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.TEST_CLIENT_ID;
    delete process.env.TEST_CLIENT_SECRET;

    expect(() =>
      createOAuthConfig({
        clientIdEnv: 'TEST_CLIENT_ID',
        clientSecretEnv: 'TEST_CLIENT_SECRET',
        redirectUriEnv: 'TEST_REDIRECT_URI',
        defaults: {
          clientId: 'default-id',
          clientSecret: 'default-secret',
          redirectUri: 'http://localhost/callback',
        },
      }),
    ).toThrow(/OAuth config incomplete/);
  });

  it('uses test-only defaults when NODE_ENV=test and env vars are unset', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_ID;

    expect(getGitHubConfig().clientId).toBe('test-github-client-id');
    expect(getAtlassianConfig().clientId).toBe('test-atlassian-client-id');
    expect(getGitHubConfig().redirectUri).toContain('/auth/github/callback');
    expect(getAtlassianConfig().redirectUri).toContain('/auth/atlassian/callback');
  });
});
