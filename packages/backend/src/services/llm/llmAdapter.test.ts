import { describe, expect, it, vi } from 'vitest';
import type {
  LlmChatMessage,
  LlmCompletionResponse,
  LlmEmbeddingResponse,
  LlmRequestOptions,
} from '@autodev/shared-types';
import { CircuitBreaker } from '../../lib/circuitBreaker.js';
import { AppError } from '../../utils/errors.js';
import { LlmAdapterService } from './llmAdapter.js';
import type { LlmProviderClient } from './llmTypes.js';
import { LocalLlmProvider } from './localProvider.js';
import { TokenBudgetManager } from './tokenBudgetManager.js';

class FailingProvider implements LlmProviderClient {
  readonly name = 'openai' as const;
  async complete(): Promise<LlmCompletionResponse> {
    throw new Error('openai down');
  }
  async chat(): Promise<LlmCompletionResponse> {
    throw new Error('openai down');
  }
  async embed(): Promise<LlmEmbeddingResponse> {
    throw new Error('openai down');
  }
}

class RecordingCache {
  store = new Map<string, LlmCompletionResponse | LlmEmbeddingResponse>();

  async get(kind: string, promptHash: string) {
    const cached = this.store.get(`${kind}:${promptHash}`);
    return cached ? { ...cached, cached: true } : null;
  }

  async set(kind: string, promptHash: string, response: LlmCompletionResponse | LlmEmbeddingResponse) {
    this.store.set(`${kind}:${promptHash}`, { ...response, cached: false });
  }
}

describe('LlmAdapterService', () => {
  it('fails over from a broken primary provider to local stub', async () => {
    const adapter = new LlmAdapterService(
      [new FailingProvider(), new LocalLlmProvider()],
      new TokenBudgetManager(10_000, 100_000),
      new RecordingCache() as never,
    );

    process.env.LLM_FAILOVER_ORDER = 'openai,local';
    const response = await adapter.complete('Hello world', { cache: false });
    expect(response.provider).toBe('local');
    expect(response.content.length).toBeGreaterThan(0);
  });

  it('opens circuit breaker after repeated provider failures', async () => {
    const provider = new FailingProvider();
    const adapter = new LlmAdapterService(
      [provider, new LocalLlmProvider()],
      new TokenBudgetManager(10_000, 100_000),
      new RecordingCache() as never,
    );
    process.env.LLM_FAILOVER_ORDER = 'openai,local';

    for (let index = 0; index < 5; index += 1) {
      await adapter.complete(`fail-${String(index)}`, { cache: false, provider: 'openai' });
    }

    expect(adapter.getCircuitBreaker('openai').getState()).toBe('open');
  });

  it('returns cached responses on repeated identical prompts', async () => {
    const cache = new RecordingCache();
    const adapter = new LlmAdapterService(
      [new LocalLlmProvider()],
      new TokenBudgetManager(10_000, 100_000),
      cache as never,
    );

    const first = await adapter.complete('cache me');
    expect(first.cached).toBe(false);

    const second = await adapter.complete('cache me');
    expect(second.cached).toBe(true);
    expect(second.content).toBe(first.content);
  });

  it('supports chat and embed through local provider', async () => {
    const adapter = new LlmAdapterService(
      [new LocalLlmProvider()],
      new TokenBudgetManager(10_000, 100_000),
      new RecordingCache() as never,
    );

    const messages: LlmChatMessage[] = [
      { role: 'system', content: 'Be concise.' },
      { role: 'user', content: 'Recommend camelCase.' },
    ];

    const chat = await adapter.chat(messages, { cache: false });
    expect(chat.provider).toBe('local');

    const embedding = await adapter.embed('naming conventions', { cache: false });
    expect(embedding.embedding).toHaveLength(4);
  });

  it('rejects oversized requests via token budget', async () => {
    const adapter = new LlmAdapterService(
      [new LocalLlmProvider()],
      new TokenBudgetManager(5, 100),
      new RecordingCache() as never,
    );

    await expect(adapter.complete('this prompt is definitely too long for five tokens')).rejects.toBeInstanceOf(
      AppError,
    );
  });
});

describe('CircuitBreaker integration with adapter helpers', () => {
  it('exposes breaker state transitions', () => {
    const now = vi.fn(() => 1_000);
    const breaker = new CircuitBreaker(2, 60_000, 30_000, now);
    breaker.recordFailure();
    breaker.recordFailure();
    expect(breaker.getState()).toBe('open');
    now.mockReturnValue(1_000 + 30_000);
    expect(breaker.getState()).toBe('half-open');
  });
});

describe('LocalLlmProvider', () => {
  it('returns configurable mock responses', async () => {
    process.env.LLM_LOCAL_MOCK_RESPONSE = 'Configured mock';
    const provider = new LocalLlmProvider();
    const options: LlmRequestOptions = { model: 'local-test' };
    const response = await provider.complete('ignored', options);
    expect(response.content).toBe('Configured mock');
    expect(response.model).toBe('local-test');
    delete process.env.LLM_LOCAL_MOCK_RESPONSE;
  });
});
