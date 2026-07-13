import { Router, type Response } from 'express';
import {
  chunkDecomposeRequestSchema,
  chunkListResponseSchema,
  chunkStatusUpdateRequestSchema,
  implementationChunkResponseSchema,
  workflowChunkIdParamsSchema,
  workflowChunkParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { chunkManager } from '../services/implementation/chunkManager.js';

export function createChunkRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/decompose',
    asyncHandler(requireSession),
    validateParams(workflowChunkParamsSchema),
    validateBody(chunkDecomposeRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const body = req.body as { prdId: string };
      const payload = await chunkManager.decompose(req.user!, id, body);
      chunkListResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    validateParams(workflowChunkParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await chunkManager.listForWorkflow(req.user!, id);
      chunkListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.patch(
    '/:chunkId/status',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(chunkStatusUpdateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const body = req.body as { status: Parameters<typeof chunkManager.updateStatus>[3]['status'] };
      const payload = await chunkManager.updateStatus(req.user!, id, chunkId, body);
      implementationChunkResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
