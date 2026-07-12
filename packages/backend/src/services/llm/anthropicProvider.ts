import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmRequestOptions,
} from '@autodev/shared-types';
import { assertAllowedUrl } from '../../lib/urlAllowlist.js';
import { AppError } from '../../utils/errors.js';
import type { LlmProviderClient } from './llmTypes.js';

const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';

interface AnthropicMessageResponse {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

function requireApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new AppError(
      'LlmProviderUnavailable',
      'Anthropic API key is not configured.',
      503,
      'Set ANTHROPIC_API_KEY to enable the Anthropic provider.',
    );
  }
  return apiKey;
}

function toAnthropicMessages(messages: LlmChatMessage[]): {
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
} {
  const systemParts = messages.filter((message) => message.role === 'system').map((message) => message.content);
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: message.content,
    }));

  return {
    system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
    messages: conversation,
  };
}

export class AnthropicProvider implements LlmProviderClient {
  readonly name = 'anthropic' as const;

  async complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    return this.chat([{ role: 'user', content: prompt }], options);
  }

  async chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    const apiKey = requireApiKey();
    assertAllowedUrl(ANTHROPIC_MESSAGES_URL);
    const payloadMessages = toAnthropicMessages(messages);

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options?.model ?? 'claude-3-5-sonnet-latest',
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.2,
        system: payloadMessages.system,
        messages: payloadMessages.messages,
      }),
    });

    if (!response.ok) {
      throw new AppError(
        'LlmProviderError',
        `Anthropic chat request failed with status ${String(response.status)}.`,
        502,
        'Retry later or switch LLM providers.',
      );
    }

    const payload = (await response.json()) as AnthropicMessageResponse;
    const content = payload.content?.find((part) => part.type === 'text')?.text?.trim();
    if (!content) {
      throw new AppError(
        'LlmProviderError',
        'Anthropic returned an empty completion.',
        502,
        'Retry the request or inspect Anthropic response logs.',
      );
    }

    const promptTokens = payload.usage?.input_tokens ?? 0;
    const completionTokens = payload.usage?.output_tokens ?? 0;

    return {
      content,
      provider: 'anthropic',
      model: payload.model ?? options?.model ?? 'claude-3-5-sonnet-latest',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cached: false,
    };
  }

  async embed(_text: string, _options?: LlmRequestOptions): Promise<LlmEmbeddingResponse> {
    throw new AppError(
      'LlmProviderUnavailable',
      'Anthropic embeddings are not supported by this adapter.',
      501,
      'Use the OpenAI or local provider for embeddings.',
    );
  }
}
