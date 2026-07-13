import { Router, type Response } from 'express';
import {
  scheduleErasureSchema,
  updateUserProfileSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody } from '../middleware/validateRequest.js';
import {
  DataSubjectRightsService,
  dataSubjectRightsService,
} from '../services/gdpr/dataSubjectRightsService.js';
import type { Clock } from '../services/classification/retentionJob.js';

export interface CreateUserRouterOptions {
  service?: DataSubjectRightsService;
  clock?: Clock;
}

export function createUserRouter(options: CreateUserRouterOptions = {}): Router {
  const router = Router();
  const service =
    options.service ??
    (options.clock
      ? new DataSubjectRightsService({ clock: options.clock })
      : dataSubjectRightsService);

  router.get(
    '/data-export',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await service.exportUserData(
        req.user!,
        String(req.user!._id),
        req.ip,
      );
      res.status(200).json(payload);
    }),
  );

  router.put(
    '/profile',
    asyncHandler(requireSession),
    validateBody(updateUserProfileSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await service.updateProfile(
        req.user!,
        req.body,
        String(req.user!._id),
        req.ip,
      );
      res.status(200).json(payload);
    }),
  );

  router.delete(
    '/data',
    asyncHandler(requireSession),
    validateBody(scheduleErasureSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await service.scheduleErasure(
        req.user!,
        req.body,
        String(req.user!._id),
        req.ip,
      );
      res.status(202).json(payload);
    }),
  );

  router.post(
    '/data/cancel-erasure',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await service.cancelErasure(
        req.user!,
        String(req.user!._id),
        req.ip,
      );
      res.status(200).json(payload);
    }),
  );

  return router;
}
