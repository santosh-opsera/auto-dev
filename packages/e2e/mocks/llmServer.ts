import express, { type Express } from 'express';
import type { Server } from 'node:http';
import { mockLlmChatResponse, mockLlmEmbedding, mockLlmHealth } from '../fixtures/llm.js';
import { MOCK_PORTS, mockBaseUrl } from './ports.js';

export function createLlmMockApp(): Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', (_req, res) => {
    res.json(mockLlmHealth);
  });

  app.post('/v1/chat/completions', (req, res) => {
    const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const lastUser = [...messages].reverse().find((message) => message?.role === 'user');
    const promptHint =
      typeof lastUser?.content === 'string' ? lastUser.content.slice(0, 80) : 'no prompt';

    res.json({
      id: 'chatcmpl-e2e-mock',
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: mockLlmChatResponse.model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: `${mockLlmChatResponse.content}\n\n[e2e mock echoed: ${promptHint}]`,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: mockLlmChatResponse.usage.promptTokens,
        completion_tokens: mockLlmChatResponse.usage.completionTokens,
        total_tokens: mockLlmChatResponse.usage.totalTokens,
      },
    });
  });

  app.post('/v1/embeddings', (_req, res) => {
    res.json({
      object: 'list',
      data: [{ object: 'embedding', index: 0, embedding: mockLlmEmbedding.embedding }],
      model: mockLlmEmbedding.model,
      usage: {
        prompt_tokens: mockLlmEmbedding.usage.promptTokens,
        total_tokens: mockLlmEmbedding.usage.totalTokens,
      },
    });
  });

  app.post('/v1/complete', (_req, res) => {
    res.json(mockLlmChatResponse);
  });

  return app;
}

export async function startLlmMock(
  port = MOCK_PORTS.llm,
): Promise<{ server: Server; baseUrl: string; port: number }> {
  const app = createLlmMockApp();
  const server = await new Promise<Server>((resolve) => {
    const listening = app.listen(port, '127.0.0.1', () => resolve(listening));
  });
  return { server, baseUrl: mockBaseUrl(port), port };
}
