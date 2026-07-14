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
 * Factory that reads OAuth provider credentials from environment variables
 * with consistent placeholder defaults (fail-fast validation is WO-004).
 */
export function createOAuthConfig(spec: OAuthConfigEnvSpec): OAuthProviderConfig {
  return {
    clientId: process.env[spec.clientIdEnv] ?? spec.defaults.clientId,
    clientSecret: process.env[spec.clientSecretEnv] ?? spec.defaults.clientSecret,
    redirectUri: process.env[spec.redirectUriEnv] ?? spec.defaults.redirectUri,
    frontendUrl: process.env.FRONTEND_URL ?? DEFAULT_FRONTEND_URL,
  };
}

export function getGitHubConfig(): OAuthProviderConfig {
  return createOAuthConfig({
    clientIdEnv: 'GITHUB_CLIENT_ID',
    clientSecretEnv: 'GITHUB_CLIENT_SECRET',
    redirectUriEnv: 'GITHUB_REDIRECT_URI',
    defaults: {
      clientId: 'github-client-id',
      clientSecret: 'github-client-secret',
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
      clientId: 'atlassian-client-id',
      clientSecret: 'atlassian-client-secret',
      redirectUri: 'http://localhost:3002/api/v1/auth/atlassian/callback',
    },
  });
}
