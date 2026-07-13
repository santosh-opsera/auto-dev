import {
  sampleLlmCompletionResponse,
  sampleLlmEmbeddingResponse,
} from '@autodev/shared-types';

export const mockLlmChatResponse = {
  ...sampleLlmCompletionResponse,
  provider: 'mock-express',
  model: 'e2e-mock-llm',
};

export const mockLlmEmbedding = {
  ...sampleLlmEmbeddingResponse,
  provider: 'mock-express',
  model: 'e2e-mock-embed',
};

export const mockLlmHealth = {
  status: 'ok' as const,
  provider: 'mock-express',
  models: ['e2e-mock-llm', 'e2e-mock-embed'],
};
