import { Router, type Response } from 'express';
import {
  deploymentCreateRequestSchema,
  deploymentIdParamsSchema,
  deploymentResponseSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { deploymentService } from '../services/deployment/deploymentService.js';

export function createDeploymentRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateBody(deploymentCreateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await deploymentService.create(req.user!, req.body);
      deploymentResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(requireSession),
    validateParams(deploymentIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await deploymentService.get(req.user!, id);
      deploymentResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/stop',
    asyncHandler(requireSession),
    validateParams(deploymentIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await deploymentService.stop(req.user!, id);
      deploymentResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
