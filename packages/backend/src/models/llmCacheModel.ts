import mongoose, { type HydratedDocument, type Model } from 'mongoose';
import type { LlmCompletionResponse, LlmEmbeddingResponse, LlmProvider } from '@autodev/shared-types';
import { createBaseSchema, type AuditFields } from '../database/baseSchema.js';

const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60;

export type LlmCacheKind = 'complete' | 'chat' | 'embed';

export interface LlmCacheDocument extends AuditFields {
  promptHash: string;
  kind: LlmCacheKind;
  provider: LlmProvider;
  model: string;
  response: LlmCompletionResponse | LlmEmbeddingResponse;
  expiresAt: Date;
}

export type LlmCacheRecord = HydratedDocument<LlmCacheDocument>;

const llmCacheSchema = createBaseSchema({
  promptHash: { type: String, required: true, index: true },
  kind: { type: String, enum: ['complete', 'chat', 'embed'], required: true },
  provider: { type: String, enum: ['openai', 'anthropic', 'local'], required: true },
  model: { type: String, required: true },
  response: { type: mongoose.Schema.Types.Mixed, required: true },
  expiresAt: { type: Date, required: true },
});

llmCacheSchema.index({ promptHash: 1, kind: 1 }, { unique: true });
llmCacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export function getLlmCacheModel(): Model<LlmCacheDocument> {
  if (mongoose.models.LlmCacheRecord) {
    return mongoose.models.LlmCacheRecord as Model<LlmCacheDocument>;
  }

  return mongoose.model<LlmCacheDocument>('LlmCacheRecord', llmCacheSchema, 'llm_cache');
}

export function buildLlmCacheExpiryDate(now = Date.now()): Date {
  const hours = Number(process.env.LLM_CACHE_TTL_HOURS ?? 24);
  const ttlSeconds = Number.isFinite(hours) && hours > 0 ? hours * 60 * 60 : DEFAULT_CACHE_TTL_SECONDS;
  return new Date(now + ttlSeconds * 1000);
}
