import type { NextFunction, Request, Response } from 'express';
import { SESSION_COOKIE_NAME } from '../auth/constants.js';
import { touchSession } from '../auth/sessionService.js';
import { findUserById, type UserRecord } from '../models/userModel.js';
import type { SessionMetadata } from '../auth/sessionService.js';
import { AppError } from '../utils/errors.js';
import { updateRequestContext } from '../utils/requestContext.js';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
  session?: SessionMetadata;
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, unknown>;
  const value = cookies[name];
  return typeof value === 'string' ? value : undefined;
}

export async function requireSession(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const sessionId = getCookieValue(req, SESSION_COOKIE_NAME);

  if (!sessionId) {
    next(new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.'));
    return;
  }

  const metadata = await touchSession(sessionId);

  if (!metadata) {
    next(new AppError('Unauthorized', 'Session expired.', 401, 'Sign in again.'));
    return;
  }

  const user = await findUserById(metadata.userId);

  if (!user) {
    next(new AppError('Unauthorized', 'User not found.', 401, 'Sign in again.'));
    return;
  }

  req.session = metadata;
  req.user = user;
  updateRequestContext({ actor: String(user._id) });
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    next(new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.'));
    return;
  }

  if (req.user.role !== 'admin') {
    next(new AppError('Forbidden', 'Admin access is required.', 403, 'Sign in with an admin account.'));
    return;
  }

  next();
}
