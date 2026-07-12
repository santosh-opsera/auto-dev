import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmRequestOptions,
} from '@autodev/shared-types';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { AppError } from '../../utils/errors.js';
import type { LlmProviderClient } from './llmTypes.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const OPENAI_EMBED_URL = 'https://api.openai.com/v1/embeddings';

interface OpenAiChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface OpenAiEmbedResponse {
  model?: string;
  data?: Array<{ embedding?: number[] }>;
  usage?: {
    prompt_tokens?: number;
    total_tokens?: number;
  };
}

function requireApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      'LlmProviderUnavailable',
      'OpenAI API key is not configured.',
      503,
      'Set OPENAI_API_KEY to enable the OpenAI provider.',
    );
  }
  return apiKey;
}

export class OpenAiProvider implements LlmProviderClient {
  readonly name = 'openai' as const;

  async complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    const apiKey = requireApiKey();
    assertAllowedUrl(OPENAI_CHAT_URL);

    const response = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? 'gpt-4',
        temperature: options?.temperature ?? 0.2,
        max_tokens: options?.maxTokens,
        messages,
      }),
    });

    if (!response.ok) {
      throw new AppError(
        'LlmProviderError',
        `OpenAI chat request failed with status ${String(response.status)}.`,
        502,
        'Retry later or switch LLM providers.',
      );
    }

    const payload = (await response.json()) as OpenAiChatResponse;
    const content = payload.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new AppError(
        'LlmProviderError',
        'OpenAI returned an empty completion.',
        502,
        'Retry the request or inspect OpenAI response logs.',
      );
    }

    const promptTokens = payload.usage?.prompt_tokens ?? 0;
    const completionTokens = payload.usage?.completion_tokens ?? 0;

    return {
      content,
      provider: 'openai',
      model: payload.model ?? options?.model ?? 'gpt-4',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: payload.usage?.total_tokens ?? promptTokens + completionTokens,
      },
      cached: false,
    };
  }

  async embed(text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse> {
    const apiKey = requireApiKey();
    assertAllowedUrl(OPENAI_EMBED_URL);

    const response = await fetch(OPENAI_EMBED_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? 'text-embedding-3-small',
        input: text,
      }),
    });

    if (!response.ok) {
      throw new AppError(
        'LlmProviderError',
        `OpenAI embed request failed with status ${String(response.status)}.`,
        502,
        'Retry later or switch LLM providers.',
      );
    }

    const payload = (await response.json()) as OpenAiEmbedResponse;
    const embedding = payload.data?.[0]?.embedding;
    if (!embedding) {
      throw new AppError(
        'LlmProviderError',
        'OpenAI returned an empty embedding.',
        502,
        'Retry the request or inspect OpenAI response logs.',
      );
    }

    const promptTokens = payload.usage?.prompt_tokens ?? 0;

    return {
      embedding,
      provider: 'openai',
      model: payload.model ?? options?.model ?? 'text-embedding-3-small',
      usage: {
        promptTokens,
        completionTokens: 0,
        totalTokens: payload.usage?.total_tokens ?? promptTokens,
      },
      cached: false,
    };
  }
}
