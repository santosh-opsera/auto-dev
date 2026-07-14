const DEV_ENCRYPTION_KEY = 'dev-only-encryption-key-change-me';

const REQUIRED_IN_PRODUCTION = [
  'ENCRYPTION_KEY',
  'MONGODB_URI',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'ATLASSIAN_CLIENT_ID',
  'ATLASSIAN_CLIENT_SECRET',
] as const;

/** Values that silently masked misconfig in older helpers — never allowed outside test. */
export const OAUTH_PLACEHOLDER_VALUES = [
  'github-client-id',
  'github-client-secret',
  'atlassian-client-id',
  'atlassian-client-secret',
] as const;

/** Clearly marked test-only defaults — allowed only when NODE_ENV=test. */
export const OAUTH_TEST_DEFAULTS = {
  GITHUB_CLIENT_ID: 'test-github-client-id',
  GITHUB_CLIENT_SECRET: 'test-github-client-secret',
  ATLASSIAN_CLIENT_ID: 'test-atlassian-client-id',
  ATLASSIAN_CLIENT_SECRET: 'test-atlassian-client-secret',
} as const;

export type OAuthEnvKey = keyof typeof OAUTH_TEST_DEFAULTS;

function isJiraIntegrationEnabled(): boolean {
  const flag = process.env.ATLASSIAN_JIRA_DISABLED?.trim().toLowerCase();
  return flag !== 'true' && flag !== '1' && flag !== 'yes';
}

function readRequired(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set ${name} in the environment (see .env.example) and restart the application.`,
    );
  }
  return value;
}

function rejectPlaceholder(name: string, value: string): void {
  if ((OAUTH_PLACEHOLDER_VALUES as readonly string[]).includes(value)) {
    throw new Error(
      `Environment variable ${name} is set to the placeholder value "${value}". ` +
        `Replace it with a real OAuth credential before starting the application.`,
    );
  }
}

/**
 * Fail-fast OAuth env validation. Runs for all NODE_ENV values.
 * In NODE_ENV=test, missing vars are filled with clearly marked test-only defaults.
 */
export function validateOAuthEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  const isTest = env.NODE_ENV === 'test';

  const ensure = (name: OAuthEnvKey): void => {
    let value = env[name]?.trim() ?? '';
    if (!value && isTest) {
      value = OAUTH_TEST_DEFAULTS[name];
      env[name] = value;
    }
    if (!value) {
      throw new Error(
        `Missing required environment variable: ${name}. ` +
          `Set ${name} in the environment (see .env.example) and restart the application.`,
      );
    }
    rejectPlaceholder(name, value);
  };

  ensure('GITHUB_CLIENT_ID');
  ensure('GITHUB_CLIENT_SECRET');

  if (isJiraIntegrationEnabled()) {
    ensure('ATLASSIAN_CLIENT_ID');
    ensure('ATLASSIAN_CLIENT_SECRET');
  }
}

export function validateEnv(): void {
  validateOAuthEnv();

  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  const missing = REQUIRED_IN_PRODUCTION.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables in production: ${missing.join(', ')}. ` +
        'Set each variable to a non-empty value before starting.',
    );
  }

  if (process.env.ENCRYPTION_KEY === DEV_ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY must be set to a unique secret in production');
  }

  // Re-check production OAuth for placeholders / emptiness (validateOAuthEnv already ran)
  for (const name of [
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'ATLASSIAN_CLIENT_ID',
    'ATLASSIAN_CLIENT_SECRET',
  ] as const) {
    rejectPlaceholder(name, readRequired(name));
  }
}
