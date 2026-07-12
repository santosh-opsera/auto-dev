import { createHash } from 'node:crypto';
import type { LlmCompletionResponse, LlmEmbeddingResponse } from '@autodev/shared-types';
import {
  buildLlmCacheExpiryDate,
  getLlmCacheModel,
  type LlmCacheKind,
} from '../../models/llmCacheModel.js';

export function hashPromptPayload(kind: LlmCacheKind, payload: unknown): string {
  return createHash('sha256').update(JSON.stringify({ kind, payload })).digest('hex');
}

export class LlmResponseCache {
  async get(
    kind: LlmCacheKind,
    promptHash: string,
  ): Promise<LlmCompletionResponse | LlmEmbeddingResponse | null> {
    const record = await getLlmCacheModel()
      .findOne({
        kind,
        promptHash,
        expiresAt: { $gt: new Date() },
      })
      .exec();

    if (!record) {
      return null;
    }

    return {
      ...record.response,
      cached: true,
    };
  }

  async set(
    kind: LlmCacheKind,
    promptHash: string,
    response: LlmCompletionResponse | LlmEmbeddingResponse,
  ): Promise<void> {
    await getLlmCacheModel()
      .findOneAndUpdate(
        { kind, promptHash },
        {
          $set: {
            kind,
            promptHash,
            provider: response.provider,
            model: response.model,
            response: { ...response, cached: false },
            expiresAt: buildLlmCacheExpiryDate(),
            updatedBy: 'system',
          },
          $setOnInsert: {
            createdBy: 'system',
          },
        },
        { upsert: true, new: true },
      )
      .exec();
  }
}

export const llmResponseCache = new LlmResponseCache();
