import { z } from 'zod';

export const llmProviderSchema = z.enum(['openai', 'anthropic', 'local']);

export type LlmProvider = z.infer<typeof llmProviderSchema>;

export const llmChatRoleSchema = z.enum(['system', 'user', 'assistant']);

export type LlmChatRole = z.infer<typeof llmChatRoleSchema>;

export const llmChatMessageSchema = z.object({
  role: llmChatRoleSchema,
  content: z.string().min(1),
});

export type LlmChatMessage = z.infer<typeof llmChatMessageSchema>;

export const llmRequestOptionsSchema = z.object({
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  cache: z.boolean().optional(),
  provider: llmProviderSchema.optional(),
});

export type LlmRequestOptions = z.infer<typeof llmRequestOptionsSchema>;

export const llmUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
});

export type LlmUsage = z.infer<typeof llmUsageSchema>;

export const llmCompletionResponseSchema = z.object({
  content: z.string(),
  provider: llmProviderSchema,
  model: z.string(),
  usage: llmUsageSchema,
  cached: z.boolean(),
});

export type LlmCompletionResponse = z.infer<typeof llmCompletionResponseSchema>;

export const llmEmbeddingResponseSchema = z.object({
  embedding: z.array(z.number()),
  provider: llmProviderSchema,
  model: z.string(),
  usage: llmUsageSchema,
  cached: z.boolean(),
});

export type LlmEmbeddingResponse = z.infer<typeof llmEmbeddingResponseSchema>;

export const llmCompleteRequestSchema = z.object({
  prompt: z.string().min(1),
  options: llmRequestOptionsSchema.optional(),
});

export type LlmCompleteRequest = z.infer<typeof llmCompleteRequestSchema>;

export const llmChatRequestSchema = z.object({
  messages: z.array(llmChatMessageSchema).min(1),
  options: llmRequestOptionsSchema.optional(),
});

export type LlmChatRequest = z.infer<typeof llmChatRequestSchema>;

export const llmEmbedRequestSchema = z.object({
  text: z.string().min(1),
  options: llmRequestOptionsSchema.optional(),
});

export type LlmEmbedRequest = z.infer<typeof llmEmbedRequestSchema>;
