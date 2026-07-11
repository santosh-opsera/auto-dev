import { z } from 'zod';
import { sprintContextSchema, ticketKeySchema } from './tickets.js';

export const gapSeveritySchema = z.enum(['critical', 'warning']);

export type GapSeverity = z.infer<typeof gapSeveritySchema>;

export const gapItemSchema = z.object({
  field: z.string(),
  severity: gapSeveritySchema,
  description: z.string(),
  suggestedAction: z.string(),
});

export type GapItem = z.infer<typeof gapItemSchema>;

export const ticketIntentMetadataSchema = z.object({
  sourceSummary: z.string(),
  labels: z.array(z.string()),
  sprintContext: sprintContextSchema.optional(),
  issueType: z.string().optional(),
  parsedAt: z.string().datetime(),
});

export const ticketIntentSchema = z.object({
  ticketKey: ticketKeySchema,
  problemStatement: z.string(),
  proposedApproach: z.string(),
  acceptanceCriteria: z.array(z.string()),
  affectedComponents: z.array(z.string()),
  dependencies: z.array(z.string()),
  constraints: z.array(z.string()),
  metadata: ticketIntentMetadataSchema,
});

export type TicketIntent = z.infer<typeof ticketIntentSchema>;

export const ticketParseResponseSchema = z.object({
  intent: ticketIntentSchema,
  gaps: z.array(gapItemSchema),
  canProceedToAnalysis: z.boolean(),
  persistedId: z.string(),
});

export type TicketParseResponse = z.infer<typeof ticketParseResponseSchema>;
