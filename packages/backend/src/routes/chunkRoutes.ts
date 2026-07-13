import { Router, type Response } from 'express';
import {
  chunkDecomposeRequestSchema,
  chunkListResponseSchema,
  chunkStatusUpdateRequestSchema,
  cursorContextResponseSchema,
  cursorExecuteRequestSchema,
  cursorExecuteResponseSchema,
  cursorResultsSubmitRequestSchema,
  cursorResultsSubmitResponseSchema,
  implementationChunkResponseSchema,
  workflowChunkIdParamsSchema,
  workflowChunkParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { cursorBridgeService } from '../services/cursor/cursorBridgeService.js';
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

  router.get(
    '/:chunkId/context',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await cursorBridgeService.getContext(req.user!, id, chunkId);
      cursorContextResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:chunkId/execute',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(cursorExecuteRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await cursorBridgeService.execute(req.user!, id, chunkId, req.body);
      cursorExecuteResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:chunkId/results',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(cursorResultsSubmitRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await cursorBridgeService.submitResults(req.user!, id, chunkId, req.body);
      cursorResultsSubmitResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
