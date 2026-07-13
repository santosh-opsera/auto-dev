import type { NextFunction, Response } from 'express';
import { AppError } from '../utils/errors.js';
import { approvalGateService } from '../services/approval/approvalGateService.js';
import type { AuthenticatedRequest } from './requireSession.js';

/**
 * Blocks downstream workflow when the referenced approval request cannot proceed.
 * Expects `req.params.requestId`.
 */
export async function requireApprovalClearance(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    next(new AppError('Unauthorized', 'Session not found.', 401, 'Sign in again.'));
    return;
  }

  const requestId = req.params.requestId;
  if (!requestId) {
    next(
      new AppError(
        'ValidationError',
        'Approval request id is required.',
        400,
        'Provide requestId in the route path.',
      ),
    );
    return;
  }

  const status = await approvalGateService.getStatus(req.user, requestId);

  if (!status.canProceed) {
    next(
      new AppError(
        'ApprovalRequired',
        'All approval gate items must be resolved before proceeding.',
        412,
        'Resolve pending or re-initiate expired approval items.',
      ),
    );
    return;
  }

  next();
}
