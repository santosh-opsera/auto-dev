import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmProvider,
  LlmRequestOptions,
} from '@autodev/shared-types';
import { CircuitBreaker } from '../../lib/circuitBreaker.js';
import { withRetry } from '../../lib/retry.js';
import { AppError } from '../../utils/errors.js';
import { AnthropicProvider } from './anthropicProvider.js';
import { hashPromptPayload, llmResponseCache, LlmResponseCache } from './llmResponseCache.js';
import { LocalLlmProvider } from './localProvider.js';
import type { LlmAdapter, LlmProviderClient } from './llmTypes.js';
import { OpenAiProvider } from './openAiProvider.js';
import { TokenBudgetManager } from './tokenBudgetManager.js';

function estimateTokensFromText(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function parseProviderOrder(): LlmProvider[] {
  const configured = process.env.LLM_FAILOVER_ORDER?.trim();
  if (configured) {
    return configured
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry): entry is LlmProvider =>
        entry === 'openai' || entry === 'anthropic' || entry === 'local',
      );
  }

  const primary = (process.env.LLM_PRIMARY_PROVIDER?.trim().toLowerCase() ?? 'local') as LlmProvider;
  const defaults: LlmProvider[] = ['openai', 'anthropic', 'local'];
  return [primary, ...defaults.filter((provider) => provider !== primary)];
}

export class LlmAdapterService implements LlmAdapter {
  private readonly breakers = new Map<LlmProvider, CircuitBreaker>();

  constructor(
    private readonly providers: LlmProviderClient[] = [
      new OpenAiProvider(),
      new AnthropicProvider(),
      new LocalLlmProvider(),
    ],
    private readonly budget = new TokenBudgetManager(),
    private readonly cache: LlmResponseCache = llmResponseCache,
    private readonly retryDelaysMs: readonly number[] = process.env.NODE_ENV === 'test' ? [0] : undefined,
  ) {
    for (const provider of this.providers) {
      this.breakers.set(provider.name, new CircuitBreaker());
    }
  }

  async complete(prompt: string, options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    const estimated = estimateTokensFromText(prompt) + (options?.maxTokens ?? 512);
    this.budget.assertWithinBudget(estimated);

    const useCache = options?.cache !== false;
    const promptHash = hashPromptPayload('complete', { prompt, options });
    if (useCache) {
      const cached = await this.cache.get('complete', promptHash);
      if (cached && 'content' in cached) {
        return cached;
      }
    }

    const response = await this.executeWithFailover((provider) => provider.complete(prompt, options), options);
    this.budget.recordUsage(response.usage.totalTokens);

    if (useCache) {
      await this.cache.set('complete', promptHash, response);
    }

    return response;
  }

  async chat(messages: LlmChatMessage[], options?: LlmRequestOptions): Promise<LlmCompletionResponse> {
    const joined = messages.map((message) => message.content).join('\n');
    const estimated = estimateTokensFromText(joined) + (options?.maxTokens ?? 512);
    this.budget.assertWithinBudget(estimated);

    const useCache = options?.cache !== false;
    const promptHash = hashPromptPayload('chat', { messages, options });
    if (useCache) {
      const cached = await this.cache.get('chat', promptHash);
      if (cached && 'content' in cached) {
        return cached;
      }
    }

    const response = await this.executeWithFailover((provider) => provider.chat(messages, options), options);
    this.budget.recordUsage(response.usage.totalTokens);

    if (useCache) {
      await this.cache.set('chat', promptHash, response);
    }

    return response;
  }

  async embed(text: string, options?: LlmRequestOptions): Promise<LlmEmbeddingResponse> {
    const estimated = estimateTokensFromText(text);
    this.budget.assertWithinBudget(estimated);

    const useCache = options?.cache !== false;
    const promptHash = hashPromptPayload('embed', { text, options });
    if (useCache) {
      const cached = await this.cache.get('embed', promptHash);
      if (cached && 'embedding' in cached) {
        return cached;
      }
    }

    const response = await this.executeWithFailover((provider) => provider.embed(text, options), options);
    this.budget.recordUsage(response.usage.totalTokens);

    if (useCache) {
      await this.cache.set('embed', promptHash, response);
    }

    return response;
  }

  getProviderOrder(preferred?: LlmProvider): LlmProviderClient[] {
    const order = preferred ? [preferred, ...parseProviderOrder().filter((name) => name !== preferred)] : parseProviderOrder();
    return order
      .map((name) => this.providers.find((provider) => provider.name === name))
      .filter((provider): provider is LlmProviderClient => Boolean(provider));
  }

  getCircuitBreaker(provider: LlmProvider): CircuitBreaker {
    const breaker = this.breakers.get(provider);
    if (!breaker) {
      throw new Error(`Unknown provider: ${provider}`);
    }
    return breaker;
  }

  getBudgetManager(): TokenBudgetManager {
    return this.budget;
  }

  private async executeWithFailover<T extends LlmCompletionResponse | LlmEmbeddingResponse>(
    operation: (provider: LlmProviderClient) => Promise<T>,
    options?: LlmRequestOptions,
  ): Promise<T> {
    const providers = this.getProviderOrder(options?.provider);
    const errors: string[] = [];

    for (const provider of providers) {
      const breaker = this.getCircuitBreaker(provider.name);
      if (!breaker.canExecute()) {
        errors.push(`${provider.name}: circuit open`);
        continue;
      }

      try {
        const result = await withRetry(
          () => operation(provider),
          this.retryDelaysMs ?? undefined,
        );
        breaker.recordSuccess();
        return result;
      } catch (error) {
        breaker.recordFailure();
        const message = error instanceof Error ? error.message : 'unknown error';
        errors.push(`${provider.name}: ${message}`);
      }
    }

    throw new AppError(
      'LlmAllProvidersFailed',
      `All LLM providers failed: ${errors.join('; ')}`,
      503,
      'Retry later or verify LLM provider configuration.',
    );
  }
}

export const llmAdapter = new LlmAdapterService();
