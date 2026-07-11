import { ATLASSIAN_LOGIN_SCOPES } from '../../auth/constants.js';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { generateCodeChallenge, generateCodeVerifier } from '../../auth/pkce.js';
import type { OAuthProfile } from './userAuthService.js';

const ATLASSIAN_TOKEN_URL = 'https://auth.atlassian.com/oauth/token';
const ATLASSIAN_USER_URL = 'https://api.atlassian.com/me';

export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

export interface AtlassianUserResponse {
  account_id: string;
  email?: string | null;
  name?: string | null;
  nickname?: string | null;
}

export interface AtlassianAuthExchangeInput {
  code: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export type AtlassianTokenFetcher = (
  input: AtlassianAuthExchangeInput,
) => Promise<AtlassianTokenResponse>;
export type AtlassianUserFetcher = (
  accessToken: string,
) => Promise<AtlassianUserResponse>;

const defaultTokenFetcher: AtlassianTokenFetcher = async (input) => {
  assertAllowedUrl(ATLASSIAN_TOKEN_URL);
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      code: input.code,
      redirect_uri: input.redirectUri,
      code_verifier: input.codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error('Atlassian token exchange failed');
  }

  return (await response.json()) as AtlassianTokenResponse;
};

const defaultUserFetcher: AtlassianUserFetcher = async (accessToken) => {
  assertAllowedUrl(ATLASSIAN_USER_URL);
  const response = await fetch(ATLASSIAN_USER_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Atlassian user lookup failed');
  }

  return (await response.json()) as AtlassianUserResponse;
};

export type AtlassianAuthPrompt = 'none' | 'login' | 'consent';

export function buildAtlassianAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
  prompt: AtlassianAuthPrompt = 'login',
  scopes: readonly string[] = ATLASSIAN_LOGIN_SCOPES,
): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: scopes.join(' '),
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
}

/** Map Atlassian OAuth callback errors to the next prompt to try. */
export function resolveAtlassianRetryPrompt(error: string): AtlassianAuthPrompt | null {
  if (error === 'consent_required') return 'consent';
  if (error === 'login_required' || error === 'interaction_required' || error === 'unauthorized') {
    return 'login';
  }
  return null;
}

export function createAtlassianPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = generateCodeVerifier();
  return {
    codeVerifier,
    codeChallenge: generateCodeChallenge(codeVerifier),
  };
}

export async function exchangeAtlassianCode(
  input: AtlassianAuthExchangeInput,
  fetchToken: AtlassianTokenFetcher = defaultTokenFetcher,
  fetchUser: AtlassianUserFetcher = defaultUserFetcher,
): Promise<OAuthProfile> {
  const tokenResponse = await fetchToken(input);
  const user = await fetchUser(tokenResponse.access_token);
  const email = user.email?.trim() || `${user.account_id}@atlassian.users.noreply`;

  return {
    provider: 'atlassian',
    providerUserId: user.account_id,
    email,
    displayName: user.name?.trim() || user.nickname?.trim() || email,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: tokenResponse.scope?.split(' ') ?? [...ATLASSIAN_LOGIN_SCOPES],
    tokenExpiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined,
  };
}

export async function refreshAtlassianAccessToken(input: {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}): Promise<AtlassianTokenResponse> {
  assertAllowedUrl(ATLASSIAN_TOKEN_URL);
  const response = await fetch(ATLASSIAN_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      client_id: input.clientId,
      client_secret: input.clientSecret,
      refresh_token: input.refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error('Atlassian refresh token exchange failed');
  }

  return (await response.json()) as AtlassianTokenResponse;
}

export const atlassianAuthInternals = {
  defaultTokenFetcher,
  defaultUserFetcher,
};
