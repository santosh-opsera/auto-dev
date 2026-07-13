import { Router, type Response } from 'express';
import {
  approvalCreateRequestSchema,
  approvalItemParamsSchema,
  approvalRequestIdParamsSchema,
  approvalRequestResponseSchema,
  approvalResolveRequestSchema,
  approvalStatusResponseSchema,
  ticketKeyParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { approvalGateService } from '../services/approval/approvalGateService.js';

export function createTicketApprovalRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    validateBody(approvalCreateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const body = req.body as { workflowId: string };

      const payload = await approvalGateService.createApprovalRequest(
        req.user!,
        ticketKey,
        body.workflowId,
      );

      approvalRequestResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  return router;
}

export function createApprovalRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:requestId',
    asyncHandler(requireSession),
    validateParams(approvalRequestIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { requestId } = req.params as { requestId: string };
      const payload = await approvalGateService.getRequest(req.user!, requestId);
      approvalRequestResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.get(
    '/:requestId/status',
    asyncHandler(requireSession),
    validateParams(approvalRequestIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { requestId } = req.params as { requestId: string };
      const payload = await approvalGateService.getStatus(req.user!, requestId);
      approvalStatusResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:requestId/items/:itemId/resolve',
    asyncHandler(requireSession),
    validateParams(approvalItemParamsSchema),
    validateBody(approvalResolveRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { requestId, itemId } = req.params as { requestId: string; itemId: string };
      const body = req.body as {
        action: 'approve' | 'reject' | 'modify';
        rationale?: string;
        modifiedValue?: string;
      };

      const payload = await approvalGateService.resolveItem(req.user!, requestId, itemId, body);
      approvalRequestResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
