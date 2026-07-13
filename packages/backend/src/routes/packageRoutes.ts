import { Router, type Response } from 'express';
import {
  packageConfirmRequestSchema,
  packageDetectRequestSchema,
  packageDetectResponseSchema,
  packageProposalIdParamsSchema,
  packagePublishProposalSchema,
  packagePublishRequestSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { packagePublishService } from '../services/packages/packagePublishService.js';

export function createPackageRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/detect',
    asyncHandler(requireSession),
    validateBody(packageDetectRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await packagePublishService.detect(req.user!, req.body);
      packageDetectResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/proposals/:id',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await packagePublishService.getProposal(req.user!, id);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/proposals/:id/confirm',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    validateBody(packageConfirmRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const { confirmationToken } = req.body as { confirmationToken: string };
      const payload = await packagePublishService.confirm(req.user!, id, confirmationToken);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/proposals/:id/publish',
    asyncHandler(requireSession),
    validateParams(packageProposalIdParamsSchema),
    validateBody(packagePublishRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const { confirmationToken } = req.body as { confirmationToken: string };
      const payload = await packagePublishService.publish(req.user!, id, confirmationToken);
      packagePublishProposalSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
