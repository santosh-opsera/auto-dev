import { Router, type Response } from 'express';
import {
  workflowCreateRequestSchema,
  workflowFailRequestSchema,
  workflowIdParamsSchema,
  workflowListQuerySchema,
  workflowListResponseSchema,
  workflowResponseSchema,
  workflowTransitionRequestSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { formatZodError, RequestValidationError } from '../utils/errors.js';
import { orchestrationService } from '../services/orchestration/orchestrationService.js';
import { createChunkRouter } from './chunkRoutes.js';
import { createPullRequestRouter } from './pullRequestRoutes.js';
import { createQaHandoffRouter } from './qaHandoffRoutes.js';

export function createWorkflowRouter(): Router {
  const router = Router({ mergeParams: true });

  router.use('/:id/chunks', createChunkRouter());
  router.use('/:id/pull-request', createPullRequestRouter());
  router.use('/:id/qa-handoff', createQaHandoffRouter());

  router.post(
    '/',
    asyncHandler(requireSession),
    validateBody(workflowCreateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const payload = await orchestrationService.createWorkflow(req.user!, req.body);
      workflowResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const parsed = workflowListQuerySchema.safeParse(req.query);
      if (!parsed.success) {
        throw new RequestValidationError(formatZodError(parsed.error));
      }

      const payload = await orchestrationService.listWorkflows(req.user!, parsed.data);
      workflowListResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:id',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.getWorkflow(req.user!, id);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/transition',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(workflowTransitionRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.transition(req.user!, id, req.body);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/pause',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const progress =
        req.body && typeof req.body === 'object' && 'progress' in req.body
          ? (req.body as { progress?: { percent?: number; phase?: string; chunkId?: string } })
              .progress
          : undefined;
      const payload = await orchestrationService.pause(req.user!, id, progress);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/resume',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.resume(req.user!, id);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/cancel',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.cancel(req.user!, id);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/fail',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    validateBody(workflowFailRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.fail(req.user!, id, req.body);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/retry',
    asyncHandler(requireSession),
    validateParams(workflowIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await orchestrationService.retry(req.user!, id);
      workflowResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
