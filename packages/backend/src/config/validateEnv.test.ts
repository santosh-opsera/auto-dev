import { afterEach, describe, expect, it } from 'vitest';
import {
  OAUTH_TEST_DEFAULTS,
  validateEnv,
  validateOAuthEnv,
} from './validateEnv.js';

function setProductionEnv(encryptionKey: string): void {
  process.env.NODE_ENV = 'production';
  process.env.ENCRYPTION_KEY = encryptionKey;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/autodev';
  process.env.GITHUB_CLIENT_ID = 'github-id';
  process.env.GITHUB_CLIENT_SECRET = 'github-secret';
  process.env.ATLASSIAN_CLIENT_ID = 'atlassian-id';
  process.env.ATLASSIAN_CLIENT_SECRET = 'atlassian-secret';
}

describe('validateOAuthEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('throws for missing GITHUB_CLIENT_ID outside test', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GITHUB_CLIENT_ID;
    process.env.GITHUB_CLIENT_SECRET = 'real-github-secret';
    process.env.ATLASSIAN_CLIENT_ID = 'real-atlassian-id';
    process.env.ATLASSIAN_CLIENT_SECRET = 'real-atlassian-secret';

    expect(() => validateOAuthEnv()).toThrow(/Missing required environment variable: GITHUB_CLIENT_ID/);
  });

  it('throws for placeholder GITHUB_CLIENT_SECRET', () => {
    process.env.NODE_ENV = 'development';
    process.env.GITHUB_CLIENT_ID = 'real-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'github-client-secret';
    process.env.ATLASSIAN_CLIENT_ID = 'real-atlassian-id';
    process.env.ATLASSIAN_CLIENT_SECRET = 'real-atlassian-secret';

    expect(() => validateOAuthEnv()).toThrow(/GITHUB_CLIENT_SECRET.*placeholder/);
  });

  it('throws for missing ATLASSIAN_CLIENT_ID when Jira is enabled', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ATLASSIAN_JIRA_DISABLED;
    process.env.GITHUB_CLIENT_ID = 'real-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'real-github-secret';
    delete process.env.ATLASSIAN_CLIENT_ID;
    process.env.ATLASSIAN_CLIENT_SECRET = 'real-atlassian-secret';

    expect(() => validateOAuthEnv()).toThrow(/Missing required environment variable: ATLASSIAN_CLIENT_ID/);
  });

  it('passes when all OAuth variables are set correctly', () => {
    process.env.NODE_ENV = 'development';
    process.env.GITHUB_CLIENT_ID = 'real-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'real-github-secret';
    process.env.ATLASSIAN_CLIENT_ID = 'real-atlassian-id';
    process.env.ATLASSIAN_CLIENT_SECRET = 'real-atlassian-secret';

    expect(() => validateOAuthEnv()).not.toThrow();
  });

  it('applies test-only defaults in NODE_ENV=test when vars are missing', () => {
    process.env.NODE_ENV = 'test';
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.GITHUB_CLIENT_SECRET;
    delete process.env.ATLASSIAN_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_SECRET;

    expect(() => validateOAuthEnv()).not.toThrow();
    expect(process.env.GITHUB_CLIENT_ID).toBe(OAUTH_TEST_DEFAULTS.GITHUB_CLIENT_ID);
    expect(process.env.GITHUB_CLIENT_SECRET).toBe(OAUTH_TEST_DEFAULTS.GITHUB_CLIENT_SECRET);
    expect(process.env.ATLASSIAN_CLIENT_ID).toBe(OAUTH_TEST_DEFAULTS.ATLASSIAN_CLIENT_ID);
    expect(process.env.ATLASSIAN_CLIENT_SECRET).toBe(OAUTH_TEST_DEFAULTS.ATLASSIAN_CLIENT_SECRET);
  });

  it('skips Atlassian vars when ATLASSIAN_JIRA_DISABLED=true', () => {
    process.env.NODE_ENV = 'development';
    process.env.ATLASSIAN_JIRA_DISABLED = 'true';
    process.env.GITHUB_CLIENT_ID = 'real-github-id';
    process.env.GITHUB_CLIENT_SECRET = 'real-github-secret';
    delete process.env.ATLASSIAN_CLIENT_ID;
    delete process.env.ATLASSIAN_CLIENT_SECRET;

    expect(() => validateOAuthEnv()).not.toThrow();
  });
});

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('requires OAuth secrets outside production (fail-fast)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.GITHUB_CLIENT_ID;
    delete process.env.ENCRYPTION_KEY;

    expect(() => validateEnv()).toThrow(/GITHUB_CLIENT_ID/);
  });

  it('requires production secrets and rejects the dev encryption key', () => {
    setProductionEnv('dev-only-encryption-key-change-me');
    expect(() => validateEnv()).toThrow(/ENCRYPTION_KEY must be set to a unique secret/);
  });

  it('passes when production secrets are configured', () => {
    setProductionEnv('production-only-secret-value');
    expect(() => validateEnv()).not.toThrow();
  });
});
