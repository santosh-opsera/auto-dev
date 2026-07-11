import { z } from 'zod';
import { repositoryNameSchema, repositoryOwnerSchema } from './repositories.js';
import { ticketKeySchema } from './tickets.js';

export const divergenceTypeSchema = z.enum(['naming', 'pattern', 'architecture']);

export type DivergenceType = z.infer<typeof divergenceTypeSchema>;

export const divergenceSeveritySchema = z.enum(['critical', 'suggestion']);

export type DivergenceSeverity = z.infer<typeof divergenceSeveritySchema>;

export const divergenceSchema = z.object({
  type: divergenceTypeSchema,
  ticketApproach: z.string(),
  codebaseConvention: z.string(),
  recommendation: z.string(),
  severity: divergenceSeveritySchema,
  affectedFiles: z.array(z.string()),
});

export type Divergence = z.infer<typeof divergenceSchema>;

export const divergenceDetectionRequestSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  workflowId: z.string().min(1),
});

export type DivergenceDetectionRequest = z.infer<typeof divergenceDetectionRequestSchema>;

export const divergenceDetectionResponseSchema = z.object({
  ticketKey: ticketKeySchema,
  workflowId: z.string(),
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  divergences: z.array(divergenceSchema),
  aligned: z.boolean(),
  summary: z.string(),
  persistedId: z.string(),
  ticketIntentId: z.string(),
  codebaseContextId: z.string(),
});

export type DivergenceDetectionResponse = z.infer<typeof divergenceDetectionResponseSchema>;
