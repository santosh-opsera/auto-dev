import { z } from 'zod';

export const EVENT_TYPES = [
  'TICKET_PARSED',
  'ANALYSIS_STARTED',
  'ANALYSIS_PROGRESS',
  'ANALYSIS_COMPLETED',
  'DIVERGENCE_DETECTED',
  'DIVERGENCE_NONE',
  'APPROVAL_REQUESTED',
  'APPROVAL_RESOLVED',
  'CONVENTION_UPDATED',
  'CHUNK_PROGRESS',
] as const;

export const eventTypeSchema = z.enum(EVENT_TYPES);

export type EventType = z.infer<typeof eventTypeSchema>;

export const eventMetadataSchema = z.object({
  eventId: z.string(),
  correlationId: z.string(),
  actor: z.string(),
  userId: z.string(),
  timestamp: z.string().datetime(),
});

export type EventMetadata = z.infer<typeof eventMetadataSchema>;

const ticketParsedPayloadSchema = z.object({
  ticketKey: z.string(),
  summary: z.string(),
});

const analysisStartedPayloadSchema = z.object({
  ticketKey: z.string().optional(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
});

const analysisProgressPayloadSchema = z.object({
  workflowId: z.string(),
  progressPercent: z.number().min(0).max(100),
  phase: z.string(),
});

const analysisCompletedPayloadSchema = z.object({
  ticketKey: z.string().optional(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
  findingsCount: z.number().int().nonnegative(),
});

const divergenceDetectedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  summary: z.string(),
  divergenceType: z.enum(['naming', 'pattern', 'architecture']).optional(),
  severity: z.enum(['critical', 'suggestion']).optional(),
});

const divergenceNonePayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  owner: z.string(),
  repo: z.string(),
  summary: z.string(),
});

const approvalRequestedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
});

const approvalResolvedPayloadSchema = z.object({
  ticketKey: z.string(),
  workflowId: z.string(),
  approvalId: z.string(),
  decision: z.enum(['ticket', 'codebase']),
});

const conventionUpdatedPayloadSchema = z.object({
  settingsId: z.string(),
  version: z.number().int().positive(),
});

const chunkProgressPayloadSchema = z.object({
  workflowId: z.string(),
  chunkId: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  progressPercent: z.number().min(0).max(100),
});

export const domainEventSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('TICKET_PARSED'),
    payload: ticketParsedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_STARTED'),
    payload: analysisStartedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_PROGRESS'),
    payload: analysisProgressPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('ANALYSIS_COMPLETED'),
    payload: analysisCompletedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('DIVERGENCE_DETECTED'),
    payload: divergenceDetectedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('DIVERGENCE_NONE'),
    payload: divergenceNonePayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_REQUESTED'),
    payload: approvalRequestedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('APPROVAL_RESOLVED'),
    payload: approvalResolvedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('CONVENTION_UPDATED'),
    payload: conventionUpdatedPayloadSchema,
    metadata: eventMetadataSchema,
  }),
  z.object({
    type: z.literal('CHUNK_PROGRESS'),
    payload: chunkProgressPayloadSchema,
    metadata: eventMetadataSchema,
  }),
]);

export type DomainEvent = z.infer<typeof domainEventSchema>;

export type DomainEventByType<T extends EventType> = Extract<DomainEvent, { type: T }>;

export const publishEventOptionsSchema = z.object({
  awaitHandlers: z.boolean().optional(),
});

export type PublishEventOptions = z.infer<typeof publishEventOptionsSchema>;
