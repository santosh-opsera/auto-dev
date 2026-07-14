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

  it('falls back to placeholder defaults when env vars are unset', () => {
    delete process.env.TEST_CLIENT_ID;
    delete process.env.TEST_CLIENT_SECRET;
    delete process.env.TEST_REDIRECT_URI;
    delete process.env.FRONTEND_URL;

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

    expect(config.clientId).toBe('default-id');
    expect(config.clientSecret).toBe('default-secret');
    expect(config.redirectUri).toBe('http://localhost/callback');
    expect(config.frontendUrl).toBe('http://localhost:3001');
  });

  it('getGitHubConfig and getAtlassianConfig delegate to createOAuthConfig', () => {
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_ID;

    expect(getGitHubConfig().clientId).toBe('github-client-id');
    expect(getAtlassianConfig().clientId).toBe('atlassian-client-id');
    expect(getGitHubConfig().redirectUri).toContain('/auth/github/callback');
    expect(getAtlassianConfig().redirectUri).toContain('/auth/atlassian/callback');
  });
});
