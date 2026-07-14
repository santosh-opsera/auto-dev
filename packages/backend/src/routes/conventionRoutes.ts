import { Router, type Response } from 'express';
import {
  conventionDefaultsResponseSchema,
  conventionHistoryResponseSchema,
  conventionSettingsInputSchema,
  conventionSettingsListResponseSchema,
  conventionSettingsParamsSchema,
  conventionSettingsResponseSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { conventionService } from '../services/conventions/conventionService.js';

export function createConventionRouter(): Router {
  const router = Router();

  router.get(
    '/defaults',
    asyncHandler(requireSession),
    asyncHandler(async (_req: AuthenticatedRequest, res: Response) => {
      const payload = conventionService.getDefaults();
      conventionDefaultsResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/history',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await conventionService.getHistory(String(req.user!._id));
      conventionHistoryResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const settings = await conventionService.getActive(String(req.user!._id));
      const payload = { settings };
      conventionSettingsListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/',
    asyncHandler(requireSession),
    validateBody(conventionSettingsInputSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const settings = await conventionService.create(
        String(req.user!._id),
        req.body,
        String(req.user!._id),
      );
      conventionSettingsResponseSchema.parse(settings);
      res.status(201).json(settings);
    }),
  );

  router.put(
    '/:id',
    asyncHandler(requireSession),
    validateParams(conventionSettingsParamsSchema),
    validateBody(conventionSettingsInputSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const settings = await conventionService.createVersion(
        String(req.user!._id),
        String(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id),
        req.body,
        String(req.user!._id),
      );
      conventionSettingsResponseSchema.parse(settings);
      res.status(200).json(settings);
    }),
  );

  return router;
}
