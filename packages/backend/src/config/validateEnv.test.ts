import { afterEach, describe, expect, it } from 'vitest';
import { validateEnv } from './validateEnv.js';

function setProductionEnv(encryptionKey: string): void {
  process.env.NODE_ENV = 'production';
  process.env.ENCRYPTION_KEY = encryptionKey;
  process.env.MONGODB_URI = 'mongodb://localhost:27017/autodev';
  process.env.GITHUB_CLIENT_ID = 'github-id';
  process.env.GITHUB_CLIENT_SECRET = 'github-secret';
  process.env.ATLASSIAN_CLIENT_ID = 'atlassian-id';
  process.env.ATLASSIAN_CLIENT_SECRET = 'atlassian-secret';
}

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not require secrets outside production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.ENCRYPTION_KEY;

    expect(() => validateEnv()).not.toThrow();
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
