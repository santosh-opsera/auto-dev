import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmRequestOptions,
} from '@autodev/shared-types';
import type { LlmProviderClient } from './llmTypes.js';

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function mockComplete(prompt: string, options?: LlmRequestOptions): LlmCompletionResponse {
  const content =
    process.env.LLM_LOCAL_MOCK_RESPONSE?.trim() ||
    `Local mock response for: ${prompt.slice(0, 120)}`;
  const promptTokens = estimateTokens(prompt);
  const completionTokens = estimateTokens(content);

  return {
    content,
    provider: 'local',
    model: options?.model ?? 'local-mock',
    usage: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    },
    cached: false,
  };
}

function mockChat(messages: LlmChatMessage[], options?: LlmRequestOptions): LlmCompletionResponse {
  const joined = messages.map((message) => `${message.role}: ${message.content}`).join('\n');
  return mockComplete(joined, options);
}

function mockEmbed(text: string, options?: LlmRequestOptions): LlmEmbeddingResponse {
  const promptTokens = estimateTokens(text);
  const embedding = Array.from({ length: 4 }, (_, index) => {
    const code = text.charCodeAt(index % text.length) || 0;
    return Number(((code % 100) / 100 - 0.5).toFixed(4));
  });

  return {
    embedding,
    provider: 'local',
    model: options?.model ?? 'local-embed',
    usage: {
      promptTokens,
      completionTokens: 0,
      totalTokens: promptTokens,
    },
    cached: false,
  };
}

export class LocalLlmProvider implements LlmProviderClient {
  readonly name = 'local' as const;

  async complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return mockComplete(prompt, options);
  }

  async chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return mockChat(messages, options);
  }

  async embed(text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse> {
    return mockEmbed(text, options);
  }
}
