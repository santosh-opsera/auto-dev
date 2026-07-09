import { ATLASSIAN_SCOPES } from '../../auth/constants.js';
import { generateCodeChallenge, generateCodeVerifier } from '../../auth/pkce.js';
import type { OAuthProfile } from './userAuthService.js';

export interface AtlassianTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type: string;
}

export interface AtlassianUserResponse {
  account_id: string;
  email: string;
  name: string;
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
  const response = await fetch('https://auth.atlassian.com/oauth/token', {
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
  const response = await fetch('https://api.atlassian.com/me', {
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

export function buildAtlassianAuthorizationUrl(
  clientId: string,
  redirectUri: string,
  codeChallenge: string,
  state: string,
): string {
  const params = new URLSearchParams({
    audience: 'api.atlassian.com',
    client_id: clientId,
    scope: ATLASSIAN_SCOPES.join(' '),
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    prompt: 'consent',
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  return `https://auth.atlassian.com/authorize?${params.toString()}`;
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

  return {
    provider: 'atlassian',
    providerUserId: user.account_id,
    email: user.email,
    displayName: user.name,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token,
    scopes: tokenResponse.scope?.split(' ') ?? ATLASSIAN_SCOPES,
    tokenExpiresAt: tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : undefined,
  };
}

export const atlassianAuthInternals = {
  defaultTokenFetcher,
  defaultUserFetcher,
};
