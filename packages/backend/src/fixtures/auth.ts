export const mockGitHubTokenResponse = {
  access_token: 'gho_mock_access_token',
  refresh_token: 'gho_mock_refresh_token',
  expires_in: 3600,
  scope: 'read:user,user:email',
  token_type: 'bearer',
};

export const mockGitHubUserResponse = {
  id: 12345,
  login: 'alex-dev',
  name: 'Alex Developer',
  email: 'alex.dev@example.com',
};

export const mockAtlassianTokenResponse = {
  access_token: 'atlassian_mock_access_token',
  refresh_token: 'atlassian_mock_refresh_token',
  expires_in: 3600,
  scope: 'read:me offline_access',
  token_type: 'Bearer',
};

export const mockAtlassianJiraTokenResponse = {
  access_token: 'atlassian_mock_jira_access_token',
  refresh_token: 'atlassian_mock_jira_refresh_token',
  expires_in: 3600,
  scope: 'read:me offline_access read:jira-work read:jira-user',
  token_type: 'Bearer',
};

export const mockAtlassianRefreshSuccessResponse = {
  access_token: 'atlassian_mock_refreshed_access_token',
  refresh_token: 'atlassian_mock_rotated_refresh_token',
  expires_in: 3600,
  scope: 'read:me offline_access read:jira-work read:jira-user',
  token_type: 'Bearer',
};

export const mockAtlassianRefreshFailureResponse = {
  error: 'invalid_grant',
  error_description: 'refresh token is expired or revoked',
};

export const mockAtlassianUserResponse = {
  account_id: 'atlassian-account-001',
  email: 'alex.dev@example.com',
  name: 'Alex Developer',
};

export const mockGithubOnlyUserFixture = {
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github'] as const,
  integrations: {
    jira: false,
    githubRepos: false,
  },
};

export const mockLinkedUserFixture = {
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github', 'atlassian'] as const,
  integrations: {
    jira: true,
    githubRepos: true,
    atlassianEmail: 'alex.dev@example.com',
  },
};

export const mockGithubWithoutJiraFixture = {
  email: 'alex.dev@example.com',
  displayName: 'Alex Developer',
  connectedProviders: ['github'] as const,
  integrations: {
    jira: false,
    githubRepos: true,
  },
};

/** Mock OAuth profiles used by callback handler unit tests. */
export const mockGitHubOAuthProfile = {
  provider: 'github' as const,
  providerUserId: String(mockGitHubUserResponse.id),
  email: mockGitHubUserResponse.email ?? 'alex.dev@example.com',
  displayName: mockGitHubUserResponse.name ?? mockGitHubUserResponse.login,
  accessToken: mockGitHubTokenResponse.access_token,
  refreshToken: mockGitHubTokenResponse.refresh_token,
  scopes: ['read:user', 'user:email'],
};

export const mockGitHubRepoLinkOAuthProfile = {
  ...mockGitHubOAuthProfile,
  scopes: ['read:user', 'user:email', 'repo', 'read:org'],
};

export const mockAtlassianOAuthProfile = {
  provider: 'atlassian' as const,
  providerUserId: mockAtlassianUserResponse.account_id,
  email: mockAtlassianUserResponse.email,
  displayName: mockAtlassianUserResponse.name,
  accessToken: mockAtlassianTokenResponse.access_token,
  refreshToken: mockAtlassianTokenResponse.refresh_token,
  scopes: ['read:me', 'offline_access'],
};

/**
 * Mock OAuth callback request cookie combinations for unit/integration tests.
 * Cookie names match packages/backend/src/auth/constants.ts.
 */
export const mockOAuthCallbackCookieCombos = {
  /** SPA POST login — PKCE verifier only (no session / link cookie). */
  loginJson: {
    autodev_pkce_verifier: 'mock-pkce-verifier',
  },
  /** Browser GET login redirect — PKCE verifier only. */
  loginRedirect: {
    autodev_pkce_verifier: 'mock-pkce-verifier',
  },
  /** Account linking — session + oauth link user must match. */
  accountLinking: {
    autodev_pkce_verifier: 'mock-pkce-verifier',
    autodev_session: 'mock-session-id',
    autodev_oauth_link_uid: 'mock-user-id',
  },
  /** Mismatched link cookie vs session — treated as login, not link. */
  mismatchedLinkCookie: {
    autodev_pkce_verifier: 'mock-pkce-verifier',
    autodev_session: 'mock-session-id',
    autodev_oauth_link_uid: 'other-user-id',
  },
  /** Link cookie without session — treated as login. */
  linkCookieWithoutSession: {
    autodev_pkce_verifier: 'mock-pkce-verifier',
    autodev_oauth_link_uid: 'mock-user-id',
  },
  /** Missing PKCE verifier — auth failure. */
  missingPkce: {
    autodev_session: 'mock-session-id',
  },
  empty: {},
} as const;

export function buildMockCallbackRequest(options: {
  method?: 'GET' | 'POST';
  code?: string;
  cookies?: Record<string, string>;
  queryError?: string;
  bodyVerifier?: string;
}): {
  method: 'GET' | 'POST';
  query: Record<string, string>;
  body: Record<string, string>;
  cookies: Record<string, string>;
  ip: string;
} {
  const method = options.method ?? 'GET';
  const code = options.code ?? 'mock-code';
  const cookies = options.cookies ?? { ...mockOAuthCallbackCookieCombos.loginRedirect };

  return {
    method,
    query:
      method === 'GET'
        ? {
            code,
            ...(options.queryError ? { error: options.queryError } : {}),
          }
        : {},
    body:
      method === 'POST'
        ? {
            code,
            ...(options.bodyVerifier ? { code_verifier: options.bodyVerifier } : {}),
          }
        : {},
    cookies,
    ip: '127.0.0.1',
  };
}
