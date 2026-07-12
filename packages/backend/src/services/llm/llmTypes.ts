import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmProvider,
  LlmRequestOptions,
} from '@autodev/shared-types';

export interface LlmProviderClient {
  readonly name: LlmProvider;
  complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse>;
  chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse>;
  embed(text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse>;
}

export interface LlmAdapter {
  complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse>;
  chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse>;
  embed(text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse>;
}
