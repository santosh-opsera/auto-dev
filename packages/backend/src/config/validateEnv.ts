const DEV_ENCRYPTION_KEY = 'dev-only-encryption-key-change-me';

const REQUIRED_IN_PRODUCTION = [
  'ENCRYPTION_KEY',
  'MONGODB_URI',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'ATLASSIAN_CLIENT_ID',
  'ATLASSIAN_CLIENT_SECRET',
] as const;

export function validateEnv(): void {
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
  }

  if (process.env.ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY must be set to a unique secret in production');
  }
}
