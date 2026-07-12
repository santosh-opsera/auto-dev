import { Router, type Response } from 'express';
import {
  llmChatRequestSchema,
  llmCompleteRequestSchema,
  llmCompletionResponseSchema,
  llmEmbedRequestSchema,
  llmEmbeddingResponseSchema,
} from '@autodev/shared-types';
import { asyncHandler } from '../middleware/errorHandler.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { validateBody } from '../middleware/validateRequest.js';
import { llmAdapter } from '../services/llm/llmAdapter.js';

export function createLlmRouter(): Router {
  const router = Router();

  router.post(
    '/complete',
    asyncHandler(requireSession),
    validateBody(llmCompleteRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { prompt: string; options?: Parameters<typeof llmAdapter.complete>[1] };
      const payload = await llmAdapter.complete(body.prompt, body.options);
      llmCompletionResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/chat',
    asyncHandler(requireSession),
    validateBody(llmChatRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as {
        messages: Parameters<typeof llmAdapter.chat>[0];
        options?: Parameters<typeof llmAdapter.chat>[1];
      };
      const payload = await llmAdapter.chat(body.messages, body.options);
      llmCompletionResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  router.post(
    '/embed',
    asyncHandler(requireSession),
    validateBody(llmEmbedRequestSchema),
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
      const body = req.body as { text: string; options?: Parameters<typeof llmAdapter.embed>[1] };
      const payload = await llmAdapter.embed(body.text, body.options);
      llmEmbeddingResponseSchema.parse(payload);
      res.status(200).json(payload);
    }),
  );

  return router;
}
