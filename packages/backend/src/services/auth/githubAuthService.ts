import { GITHUB_SCOPES } from '../../auth/constants.js';
import { generateCodeChallenge, generateCodeVerifier } from '../../auth/pkce.js';
import type { OAuthProfile } from './userAuthService.js';

export interface GitHubTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

export interface GitHubUserResponse {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
}

export interface GitHubAuthExchangeInput {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type GitHubTokenFetcher = (
  input: GitHubAuthExchangeInput,
) => Promise<GitHubTokenResponse>;
export type GitHubUserFetcher = (
  accessToken: string,
) => Promise<GitHubUserResponse>;

const defaultTokenFetcher: GitHubTokenFetcher = async (input) => {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error('GitHub token exchange failed');
  }

  return (await response.json()) as GitHubTokenResponse;
};

const defaultUserFetcher: GitHubUserFetcher = async (accessToken) => {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!response.ok) {
    throw new Error('GitHub user lookup failed');
  }

  return (await response.json()) as GitHubUserResponse;
};

export function buildGitHubAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: GITHUB_SCOPES.join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function createGitHubPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateCodeVerifier();
  return {
    codeVerifier,
    codeChallenge: generateCodeChallenge(codeVerifier),
  };
}

export async function exchangeGitHubCode(
  input: GitHubAuthExchangeInput,
  fetchToken: GitHubTokenFetcher = defaultTokenFetcher,
  fetchUser: GitHubUserFetcher = defaultUserFetcher,
): Promise<OAuthProfile> {
  const tokenResponse = await fetchToken(input);
  const user = await fetchUser(tokenResponse.access_token);

  return {
    provider: 'github',
    providerUserId: String(user.id),
    email: user.email ?? `${user.login}@users.noreply.github.com`,
    displayName: user.name ?? user.login,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: tokenResponse.scope?.split(',') ?? GITHUB_SCOPES,
    tokenExpiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined,
  };
}

export const githubAuthInternals = {
  defaultTokenFetcher,
  defaultUserFetcher,
};
