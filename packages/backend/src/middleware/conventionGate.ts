import type { NextFunction, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { conventionSettingsRepository } from '../repositories/conventionSettingsRepository.js';
import type { AuthenticatedRequest } from './requireSession.js';

export async function requireConventionSettings(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.'));
    return;
  }

  const hasSettings = await conventionSettingsRepository.hasActiveForUser(String(req.user._id));

  if (!hasSettings) {
    next(
      new AppError(
        'Forbidden',
        'Convention settings must be configured before starting development.',
        403,
        'Create convention settings at POST /api/v1/conventions.',
      ),
    );
    return;
  }

  next();
}
