import { Router, type Response } from 'express';
import {
  prdCreateVersionRequestSchema,
  prdGenerateRequestSchema,
  prdIdParamsSchema,
  prdListResponseSchema,
  prdRejectRequestSchema,
  prdResponseSchema,
  ticketKeyParamsSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { prdGenerationService } from '../services/prd/prdGenerationService.js';

export function createTicketPrdRouter(): Router {
  const router = Router({ mergeParams: true });

  router.post(
    '/generate',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    validateBody(prdGenerateRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const body = req.body as {
        workflowId?: string;
        approvalRequestId?: string;
        owner?: string;
        repo?: string;
      };

      const payload = await prdGenerationService.generate(req.user!, ticketKey, body);
      prdResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.get(
    '/',
    asyncHandler(requireSession),
    validateParams(ticketKeyParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { ticketKey } = req.params as { ticketKey: string };
      const latest = req.query.latest;

      if (latest === 'false' || latest === '0') {
        const payload = await prdGenerationService.listForTicket(req.user!, ticketKey);
        prdListResponseSchema.parse(payload);
        res.status(200).json(payload);
        return;
      }

      const payload = await prdGenerationService.getLatestForTicket(req.user!, ticketKey);
      prdResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}

export function createPrdRouter(): Router {
  const router = Router({ mergeParams: true });

  router.get(
    '/:id',
    asyncHandler(requireSession),
    validateParams(prdIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await prdGenerationService.getById(req.user!, id);
      prdResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/versions',
    asyncHandler(requireSession),
    validateParams(prdIdParamsSchema),
    validateBody(prdCreateVersionRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const body = req.body as {
        sections: Parameters<typeof prdGenerationService.createVersion>[2]['sections'];
        status?: Parameters<typeof prdGenerationService.createVersion>[2]['status'];
      };

      const payload = await prdGenerationService.createVersion(req.user!, id, body);
      prdResponseSchema.parse(payload);
      res.status(201).json(payload);
    }),
  );

  router.post(
    '/:id/approve',
    asyncHandler(requireSession),
    validateParams(prdIdParamsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const payload = await prdGenerationService.approve(req.user!, id);
      prdResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/:id/reject',
    asyncHandler(requireSession),
    validateParams(prdIdParamsSchema),
    validateBody(prdRejectRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason: string };
      const payload = await prdGenerationService.reject(req.user!, id, reason);
      prdResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
