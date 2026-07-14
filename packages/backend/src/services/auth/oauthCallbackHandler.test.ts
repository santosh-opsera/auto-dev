import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  OAUTH_LINK_USER_COOKIE_NAME,
  PKCE_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '../../auth/constants.js';
import {
  buildMockCallbackRequest,
  mockGitHubOAuthProfile,
  mockGitHubRepoLinkOAuthProfile,
  mockOAuthCallbackCookieCombos,
} from '../../fixtures/auth.js';
import {
  handleOAuthRedirectCallback,
  resolveOAuthCallbackMode,
  type OAuthCallbackHandlerDeps,
} from './oauthCallbackHandler.js';

vi.mock('../../auth/lockoutService.js', () => ({
  isLockedOut: vi.fn(async () => false),
  recordAuthFailure: vi.fn(async () => ({ locked: false, remainingAttempts: 10 })),
  clearAuthFailures: vi.fn(async () => undefined),
}));

vi.mock('../audit/auditService.js', () => ({
  auditService: {
    logSafe: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock('../../auth/cookies.js', () => ({
  clearPkceCookie: vi.fn(),
  clearOAuthLinkUserCookie: vi.fn(),
  setSessionCookie: vi.fn(),
}));

function createMockRes(): Response & {
  redirect: ReturnType<typeof vi.fn>;
  cookie: ReturnType<typeof vi.fn>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
} {
  const res = {
    redirect: vi.fn(),
    cookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & {
    redirect: ReturnType<typeof vi.fn>;
    cookie: ReturnType<typeof vi.fn>;
    status: ReturnType<typeof vi.fn>;
    json: ReturnType<typeof vi.fn>;
  };
}

function asRequest(fixture: ReturnType<typeof buildMockCallbackRequest>): Request {
  return fixture as unknown as Request;
}

describe('resolveOAuthCallbackMode', () => {
  it('routes to link when OAUTH_LINK_USER_COOKIE matches session user', async () => {
    const req = asRequest(
      buildMockCallbackRequest({ cookies: { ...mockOAuthCallbackCookieCombos.accountLinking } }),
    );
    const touchUserSession = vi.fn().mockResolvedValue({ userId: 'mock-user-id' });

    await expect(resolveOAuthCallbackMode(req, touchUserSession)).resolves.toBe('link');
    expect(touchUserSession).toHaveBeenCalledWith('mock-session-id');
  });

  it('routes to login when link cookie is missing', async () => {
    const req = asRequest(
      buildMockCallbackRequest({ cookies: { ...mockOAuthCallbackCookieCombos.loginRedirect } }),
    );
    const touchUserSession = vi.fn();

    await expect(resolveOAuthCallbackMode(req, touchUserSession)).resolves.toBe('login');
    expect(touchUserSession).not.toHaveBeenCalled();
  });

  it('routes to login when link cookie does not match session user', async () => {
    const req = asRequest(
      buildMockCallbackRequest({
        cookies: { ...mockOAuthCallbackCookieCombos.mismatchedLinkCookie },
      }),
    );
    const touchUserSession = vi.fn().mockResolvedValue({ userId: 'mock-session-owner' });

    await expect(resolveOAuthCallbackMode(req, touchUserSession)).resolves.toBe('login');
  });

  it('routes to login when link cookie is set without a session', async () => {
    const req = asRequest(
      buildMockCallbackRequest({
        cookies: { ...mockOAuthCallbackCookieCombos.linkCookieWithoutSession },
      }),
    );

    await expect(resolveOAuthCallbackMode(req, vi.fn())).resolves.toBe('login');
  });
});

describe('handleOAuthRedirectCallback', () => {
  let deps: OAuthCallbackHandlerDeps;

  beforeEach(() => {
    deps = {
      exchangeCode: vi.fn().mockResolvedValue(mockGitHubOAuthProfile),
      upsertUser: vi.fn().mockResolvedValue({
        _id: 'new-user-id',
        email: mockGitHubOAuthProfile.email,
        displayName: mockGitHubOAuthProfile.displayName,
        connectedProviders: ['github'],
      }),
      linkProvider: vi.fn().mockResolvedValue({
        _id: 'mock-user-id',
        email: mockGitHubOAuthProfile.email,
        displayName: mockGitHubOAuthProfile.displayName,
        connectedProviders: ['github', 'atlassian'],
      }),
      createUserSession: vi.fn().mockResolvedValue({
        sessionId: 'created-session',
        refreshToken: 'created-refresh',
        metadata: {
          sessionId: 'created-session',
          userId: 'new-user-id',
          expiresAt: new Date(),
          remainingMs: 1000,
          warning: false,
        },
      }),
      touchUserSession: vi.fn().mockResolvedValue({ userId: 'mock-user-id' }),
      clearFailures: vi.fn(async () => undefined),
    };
  });

  it('links GitHub provider when OAUTH_LINK_USER_COOKIE matches session', async () => {
    vi.mocked(deps.exchangeCode).mockResolvedValue(mockGitHubRepoLinkOAuthProfile);
    const req = asRequest(
      buildMockCallbackRequest({ cookies: { ...mockOAuthCallbackCookieCombos.accountLinking } }),
    );
    const res = createMockRes();

    await handleOAuthRedirectCallback({
      req,
      res,
      provider: 'github',
      config: {
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'http://localhost:3002/api/v1/auth/github/callback',
        frontendUrl: 'http://localhost:3001',
      },
      linkRedirectPath: '/repositories',
      deps,
    });

    expect(deps.linkProvider).toHaveBeenCalledWith(
      'mock-user-id',
      mockGitHubRepoLinkOAuthProfile,
    );
    expect(deps.upsertUser).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/repositories');
  });

  it('creates a login session when OAUTH_LINK_USER_COOKIE is absent', async () => {
    const req = asRequest(
      buildMockCallbackRequest({ cookies: { ...mockOAuthCallbackCookieCombos.loginRedirect } }),
    );
    const res = createMockRes();

    await handleOAuthRedirectCallback({
      req,
      res,
      provider: 'github',
      config: {
        clientId: 'github-client-id',
        clientSecret: 'github-client-secret',
        redirectUri: 'http://localhost:3002/api/v1/auth/github/callback',
        frontendUrl: 'http://localhost:3001',
      },
      linkRedirectPath: '/repositories',
      deps,
    });

    expect(deps.upsertUser).toHaveBeenCalledWith(mockGitHubOAuthProfile);
    expect(deps.createUserSession).toHaveBeenCalledWith('new-user-id');
    expect(deps.linkProvider).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('http://localhost:3001/dashboard');
  });

  it('reads PKCE and session cookies from mock callback request fixtures', () => {
    const linking = mockOAuthCallbackCookieCombos.accountLinking;
    expect(linking[PKCE_COOKIE_NAME]).toBeTruthy();
    expect(linking[SESSION_COOKIE_NAME]).toBeTruthy();
    expect(linking[OAUTH_LINK_USER_COOKIE_NAME]).toBeTruthy();
  });
});
