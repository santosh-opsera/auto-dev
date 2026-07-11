import { Router, type Request, type Response } from 'express';
import {
  ATLASSIAN_REMEMBER_COOKIE_NAME,
  SESSION_COOKIE_NAME,
  PKCE_COOKIE_NAME,
} from '../auth/constants.js';
import {
  clearAtlassianRememberCookie,
  clearPkceCookie,
  clearSessionCookie,
  setAtlassianRememberCookie,
  setPkceCookie,
  setSessionCookie,
} from '../auth/cookies.js';
import { clearAuthFailures, isLockedOut, recordAuthFailure } from '../auth/lockoutService.js';
import { authRateLimitMiddleware } from '../middleware/appRateLimits.js';
import { generateStateToken } from '../auth/pkce.js';
import {
  createSession,
  encryptOAuthToken,
  invalidateSession,
  rotateRefreshToken,
  touchSession,
} from '../auth/sessionService.js';
import { decryptSecret } from '../lib/encryption.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AppError } from '../utils/errors.js';
import { findUserById, getUserModel } from '../models/userModel.js';
import {
  buildGitHubAuthorizationUrl,
  createGitHubPkcePair,
  exchangeGitHubCode,
} from '../services/auth/githubAuthService.js';
import {
  buildAtlassianAuthorizationUrl,
  createAtlassianPkcePair,
  exchangeAtlassianCode,
  refreshAtlassianAccessToken,
  resolveAtlassianRetryPrompt,
  type AtlassianAuthPrompt,
} from '../services/auth/atlassianAuthService.js';
import { upsertUserFromOAuth } from '../services/auth/userAuthService.js';

const REFRESH_COOKIE_NAME = 'autodev_refresh';

function getClientIp(req: Request): string {
  return req.ip ?? 'unknown';
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown>;
  const value = cookies[name];
  return typeof value === 'string' ? value : undefined;
}

function getAtlassianConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
} {
  return {
    clientId: process.env.ATLASSIAN_CLIENT_ID ?? 'atlassian-client-id',
    clientSecret: process.env.ATLASSIAN_CLIENT_SECRET ?? 'atlassian-client-secret',
    redirectUri:
      process.env.ATLASSIAN_REDIRECT_URI ?? 'http://localhost:3001/api/v1/auth/atlassian/callback',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  };
}

function getGitHubConfig(): {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  frontendUrl: string;
} {
  return {
    clientId: process.env.GITHUB_CLIENT_ID ?? 'github-client-id',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? 'github-client-secret',
    redirectUri:
      process.env.GITHUB_REDIRECT_URI ?? 'http://localhost:3001/api/v1/auth/github/callback',
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  };
}

function issueSessionCookies(
  res: Response,
  session: { sessionId: string; refreshToken: string },
): void {
  setSessionCookie(res, session.sessionId);
  res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
}

/**
 * Resume session via stored Atlassian refresh token (skips dev-mode grant screen).
 */
async function tryResumeAtlassianSession(req: Request, res: Response): Promise<boolean> {
  const rememberedUserId = getCookieValue(req, ATLASSIAN_REMEMBER_COOKIE_NAME);
  if (!rememberedUserId) {
    return false;
  }

  const user = await findUserById(rememberedUserId);
  const encryptedRefresh = user?.atlassian?.encryptedRefreshToken;
  if (!user || !encryptedRefresh) {
    clearAtlassianRememberCookie(res);
    return false;
  }

  try {
    const config = getAtlassianConfig();
    const tokenResponse = await refreshAtlassianAccessToken({
      refreshToken: decryptSecret(encryptedRefresh),
      clientId: config.clientId,
      clientSecret: config.clientSecret,
    });

    await getUserModel()
      .findByIdAndUpdate(user._id, {
        atlassian: {
          providerUserId: user.atlassian?.providerUserId,
          encryptedAccessToken: encryptOAuthToken(tokenResponse.access_token),
          encryptedRefreshToken: tokenResponse.refresh_token
            ? encryptOAuthToken(tokenResponse.refresh_token)
            : encryptedRefresh,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : user.atlassian?.tokenExpiresAt,
          scopes: tokenResponse.scope?.split(' ') ?? user.atlassian?.scopes ?? [],
        },
        updatedBy: user.email,
      })
      .exec();

    const session = await createSession(String(user._id));
    clearAuthFailures(getClientIp(req));
    issueSessionCookies(res, session);
    setAtlassianRememberCookie(res, String(user._id));
    res.redirect(`${config.frontendUrl}/dashboard`);
    return true;
  } catch {
    clearAtlassianRememberCookie(res);
    return false;
  }
}

function ensureNotLocked(req: Request): void {
  if (isLockedOut(getClientIp(req))) {
    throw new AppError(
      'AccountLocked',
      'Too many failed authentication attempts. Try again later.',
      423,
      'Wait 15 minutes before retrying authentication.',
    );
  }
}

function handleAuthFailure(req: Request): never {
  recordAuthFailure(getClientIp(req));
  throw new AppError(
    'AuthenticationFailed',
    'Authentication failed.',
    401,
    'Verify OAuth credentials and retry.',
  );
}

export function createAuthRouter(): Router {
  const router = Router();

  router.use(authRateLimitMiddleware);

  router.get('/github/start', (_req, res) => {
      const { clientId, redirectUri } = getGitHubConfig();
      const { codeVerifier, codeChallenge } = createGitHubPkcePair();
      const state = generateStateToken();
      setPkceCookie(res, codeVerifier);

      const authorizationUrl = buildGitHubAuthorizationUrl(
        clientId,
        redirectUri,
        codeChallenge,
        state,
      );

      res.redirect(authorizationUrl);
  });

  router.post(
    '/github/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const { code, code_verifier: bodyVerifier } = req.body as {
        code?: string;
        code_verifier?: string;
      };
      const codeVerifier = bodyVerifier ?? getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req);
      }

      try {
        const config = getGitHubConfig();
        const profile = await exchangeGitHubCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });

        res.status(200).json({
          user: {
            email: user.email,
            displayName: user.displayName,
            connectedProviders: user.connectedProviders,
          },
          session: session.metadata,
        });
      } catch {
        handleAuthFailure(req);
      }
    }),
  );

  router.get(
    '/github/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const code = req.query.code;
      const codeVerifier = getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req);
      }

      try {
        const config = getGitHubConfig();
        const profile = await exchangeGitHubCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });

        res.redirect(`${config.frontendUrl}/dashboard`);
      } catch {
        handleAuthFailure(req);
      }
    }),
  );

  router.get('/atlassian/start', asyncHandler(async (req, res) => {
    if (await tryResumeAtlassianSession(req, res)) {
      return;
    }

    const { clientId, redirectUri } = getAtlassianConfig();
    const { codeVerifier, codeChallenge } = createAtlassianPkcePair();
    const state = generateStateToken();
    setPkceCookie(res, codeVerifier);

    const requestedPrompt = req.query.prompt;
    const prompt: AtlassianAuthPrompt =
      requestedPrompt === 'none' || requestedPrompt === 'consent' ? requestedPrompt : 'login';

    res.redirect(buildAtlassianAuthorizationUrl(clientId, redirectUri, codeChallenge, state, prompt));
  }));

  router.post(
    '/atlassian/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const { code, code_verifier: bodyVerifier } = req.body as {
        code?: string;
        code_verifier?: string;
      };
      const codeVerifier = bodyVerifier ?? getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req);
      }

      try {
        const config = getAtlassianConfig();
        const profile = await exchangeAtlassianCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        setAtlassianRememberCookie(res, String(user._id));

        res.status(200).json({
          user: {
            email: user.email,
            displayName: user.displayName,
            connectedProviders: user.connectedProviders,
          },
          session: session.metadata,
        });
      } catch {
        handleAuthFailure(req);
      }
    }),
  );

  router.get(
    '/atlassian/callback',
    asyncHandler(async (req, res) => {
      ensureNotLocked(req);

      const oauthError = req.query.error;
      if (typeof oauthError === 'string') {
        const retryPrompt = resolveAtlassianRetryPrompt(oauthError);
        if (retryPrompt) {
          res.redirect(`/api/v1/auth/atlassian/start?prompt=${retryPrompt}`);
          return;
        }
        handleAuthFailure(req);
      }

      const code = req.query.code;
      const codeVerifier = getCookieValue(req, PKCE_COOKIE_NAME);

      if (!code || typeof code !== 'string' || !codeVerifier || typeof codeVerifier !== 'string') {
        handleAuthFailure(req);
      }

      try {
        const config = getAtlassianConfig();
        const profile = await exchangeAtlassianCode({
          code,
          codeVerifier,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          redirectUri: config.redirectUri,
        });

        const user = await upsertUserFromOAuth(profile);
        const session = await createSession(String(user._id));

        clearAuthFailures(getClientIp(req));
        clearPkceCookie(res);
        setSessionCookie(res, session.sessionId);
        res.cookie(REFRESH_COOKIE_NAME, session.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/',
        });
        setAtlassianRememberCookie(res, String(user._id));

        res.redirect(`${config.frontendUrl}/dashboard`);
      } catch {
        handleAuthFailure(req);
      }
    }),
  );

  router.post(
    '/refresh',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);
      const refreshToken = getCookieValue(req, REFRESH_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string' || !refreshToken || typeof refreshToken !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const rotated = await rotateRefreshToken(sessionId, refreshToken);

      if (!rotated) {
        handleAuthFailure(req);
      }

      clearAuthFailures(getClientIp(req));
      setSessionCookie(res, sessionId);
      res.cookie(REFRESH_COOKIE_NAME, rotated.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });

      res.status(200).json({ session: rotated.metadata });
    }),
  );

  router.post(
    '/logout',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

      if (sessionId && typeof sessionId === 'string') {
        await invalidateSession(sessionId);
      }

      clearSessionCookie(res);
      res.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
      res.status(204).send();
    }),
  );

  router.post(
    '/heartbeat',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const metadata = await touchSession(sessionId);

      if (!metadata) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in again.');
      }

      res.status(200).json({
        session: metadata,
        warning: metadata.warning
          ? 'Your session will expire in less than 5 minutes.'
          : undefined,
      });
    }),
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

      if (!sessionId || typeof sessionId !== 'string') {
        throw new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.');
      }

      const metadata = await touchSession(sessionId);

      if (!metadata) {
        throw new AppError('Unauthorized', 'Session expired.', 401, 'Sign in again.');
      }

      const user = await findUserById(metadata.userId);

      if (!user) {
        throw new AppError('Unauthorized', 'User not found.', 401, 'Sign in again.');
      }

      res.status(200).json({
        user: {
          email: user.email,
          displayName: user.displayName,
          connectedProviders: user.connectedProviders,
        },
        session: metadata,
      });
    }),
  );

  return router;
}
