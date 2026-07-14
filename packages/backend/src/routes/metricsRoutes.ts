import { Router, type Response } from 'express';
import {
  aggregatedMetricsResponseSchema,
  metricsQuerySchema,
  workflowMetricsParamsSchema,
  workflowMetricsResponseSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateParams, validateQuery } from '../middleware/validateRequest.js';
import { eventBus } from '@autodev/infrastructure';
import { metricsCollectionService } from '../services/metrics/metricsCollectionService.js';

metricsCollectionService.initialize(eventBus);

export function createMetricsRouter(): Router {
  const router = Router();

  router.get(
    '/',
    asyncHandler(requireSession),
    validateQuery(metricsQuerySchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { period } = req.query as { period: '7d' | '30d' | '90d' };
      const payload = await metricsCollectionService.getAggregatedMetrics(
        String(req.user!._id),
        period,
      );
      aggregatedMetricsResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/workflows/:id',
    asyncHandler(requireSession),
    validateParams(workflowMetricsParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await metricsCollectionService.getWorkflowMetrics(String(req.user!._id), id);
      workflowMetricsResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
