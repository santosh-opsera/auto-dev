import { describe, expect, it } from 'vitest';
import {
  llmChatRequestSchema,
  llmCompleteRequestSchema,
  llmCompletionResponseSchema,
  llmEmbeddingResponseSchema,
} from './llm.js';
import {
  sampleLlmChatMessages,
  sampleLlmCompletionResponse,
  sampleLlmEmbeddingResponse,
} from './fixtures/llm.js';

describe('llm schemas', () => {
  it('validates completion request and response', () => {
    expect(
      llmCompleteRequestSchema.safeParse({
        prompt: 'Summarize this ticket',
        options: { model: 'gpt-4', temperature: 0.2 },
      }).success,
    ).toBe(true);
    expect(llmCompletionResponseSchema.safeParse(sampleLlmCompletionResponse).success).toBe(true);
  });

  it('validates chat and embedding payloads', () => {
    expect(llmChatRequestSchema.safeParse({ messages: sampleLlmChatMessages }).success).toBe(true);
    expect(llmEmbeddingResponseSchema.safeParse(sampleLlmEmbeddingResponse).success).toBe(true);
  });
});
