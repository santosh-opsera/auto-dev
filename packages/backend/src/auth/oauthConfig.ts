export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
}

export interface OAuthConfigEnvSpec {
  clientIdEnv: string;
  clientSecretEnv: string;
  redirectUriEnv: string;
  defaults: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  };
}

const DEFAULT_FRONTEND_URL = 'http://localhost:3001';

/**
 * Factory that reads OAuth provider credentials from environment variables.
 * Defaults apply only when NODE_ENV=test (after validateOAuthEnv fills test defaults).
 * Outside test, missing values throw so misconfig cannot silently use placeholders.
 */
export function createOAuthConfig(spec: OAuthConfigEnvSpec): OAuthProviderConfig {
  const clientId = process.env[spec.clientIdEnv] ?? undefined;
  const clientSecret = process.env[spec.clientSecretEnv] ?? undefined;
  const redirectUri = process.env[spec.redirectUriEnv] ?? undefined;

  if (process.env.NODE_ENV === 'test') {
    return {
      clientId: clientId ?? spec.defaults.clientId,
      clientSecret: clientSecret ?? spec.defaults.clientSecret,
      redirectUri: redirectUri ?? spec.defaults.redirectUri,
      frontendUrl: process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
    };
  }

  if (!clientId?.trim() || !clientSecret?.trim()) {
    throw new Error(
      `OAuth config incomplete: set ${spec.clientIdEnv} and ${spec.clientSecretEnv} ` +
        `(run validateOAuthEnv at startup).`,
    );
  }

  return {
    clientId,
    clientSecret,
    redirectUri: redirectUri ?? spec.defaults.redirectUri,
    frontendUrl: process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
  };
}

export function getGitHubConfig(): OAuthProviderConfig {
  return createOAuthConfig({
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    redirectUriEnv: 'GITHUB_REDIRECT_URI',
    defaults: {
      clientId: 'test-github-client-id',
      clientSecret: 'test-github-client-secret',
      redirectUri: 'http://localhost:3002/api/v1/auth/github/callback',
    },
  });
}

export function getAtlassianConfig(): OAuthProviderConfig {
  return createOAuthConfig({
    clientIdEnv: 'ATLASSIAN_CLIENT_ID',
    clientSecretEnv: 'ATLASSIAN_CLIENT_SECRET',
    redirectUriEnv: 'ATLASSIAN_REDIRECT_URI',
    defaults: {
      clientId: 'test-atlassian-client-id',
      clientSecret: 'test-atlassian-client-secret',
      redirectUri: 'http://localhost:3002/api/v1/auth/atlassian/callback',
    },
  });
}
