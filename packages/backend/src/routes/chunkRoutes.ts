import { Router, type Response } from 'express';
import {
  branchNamePreviewResponseSchema,
  branchPreviewQuerySchema,
  chunkBranchResponseSchema,
  chunkCommitResponseSchema,
  chunkDecomposeRequestSchema,
  chunkListResponseSchema,
  chunkStatusUpdateRequestSchema,
  commitChunkRequestSchema,
  commitMessagePreviewResponseSchema,
  commitPreviewQuerySchema,
  createChunkBranchRequestSchema,
  cursorContextResponseSchema,
  cursorExecuteRequestSchema,
  cursorExecuteResponseSchema,
  cursorResultsSubmitRequestSchema,
  cursorResultsSubmitResponseSchema,
  chunkTestRequestSchema,
  chunkTestResponseSchema,
  implementationChunkResponseSchema,
  workflowChunkIdParamsSchema,
  workflowChunkParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validateRequest.js';
import { cursorBridgeService } from '../services/cursor/cursorBridgeService.js';
import { branchCommitService } from '../services/git/branchCommitService.js';
import { chunkManager } from '../services/implementation/chunkManager.js';
import { testFixService } from '../services/testing/testFixService.js';

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
    '/:chunkId/branch/preview',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateQuery(branchPreviewQuerySchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await branchCommitService.previewBranchName(req.user!, id, chunkId, req.query);
      branchNamePreviewResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:chunkId/commit/preview',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateQuery(commitPreviewQuerySchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await branchCommitService.previewCommitMessage(
        req.user!,
        id,
        chunkId,
        req.query,
      );
      commitMessagePreviewResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:chunkId/branch',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(createChunkBranchRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await branchCommitService.createBranch(req.user!, id, chunkId, req.body);
      chunkBranchResponseSchema.parse(payload);
      res.status(payload.created ? 201 : 200).json(payload);
    }),
  );

  router.post(
    '/:chunkId/commit',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(commitChunkRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await branchCommitService.commitChanges(req.user!, id, chunkId, req.body);
      chunkCommitResponseSchema.parse(payload);
      res.status(201).json(payload);
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

  router.post(
    '/:chunkId/test',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    validateBody(chunkTestRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await testFixService.runForChunk(req.user!, id, chunkId, req.body);
      chunkTestResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:chunkId/test-report',
    asyncHandler(requireSession),
    validateParams(workflowChunkIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id, chunkId } = req.params as { id: string; chunkId: string };
      const payload = await testFixService.getReport(req.user!, id, chunkId);
      chunkTestResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
