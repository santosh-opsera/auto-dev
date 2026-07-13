import { z } from 'zod';
import { codebaseContextSchema, designPatternSchema, namingConventionSchema } from './codebaseContext.js';
import { chunkComplexitySchema, chunkScopeSchema } from './chunk.js';
import { conventionSettingsInputSchema } from './conventions.js';
import { prdResponseSchema, prdSectionsSchema } from './prd.js';
import { ticketIntentSchema } from './ticketIntent.js';

export const CURSOR_CONTEXT_SCHEMA_VERSION = '1' as const;

export const cursorConventionSnapshotSchema = conventionSettingsInputSchema;

export type CursorConventionSnapshot = z.infer<typeof cursorConventionSnapshotSchema>;

export const cursorChunkSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  scope: chunkScopeSchema,
  estimatedComplexity: chunkComplexitySchema,
  dependencies: z.array(z.string()),
  order: z.number().int().nonnegative(),
});

export type CursorChunkSpec = z.infer<typeof cursorChunkSpecSchema>;

export const cursorApprovedPrdSnapshotSchema = z.object({
  id: z.string().min(1),
  ticketKey: z.string().min(1),
  version: z.number().int().positive(),
  status: z.literal('approved'),
  sections: prdSectionsSchema,
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
});

export type CursorApprovedPrdSnapshot = z.infer<typeof cursorApprovedPrdSnapshotSchema>;

/** Structured JSON context delivered to Cursor IDE for chunk implementation. */
export const cursorContextDocumentSchema = z.object({
  schemaVersion: z.literal(CURSOR_CONTEXT_SCHEMA_VERSION),
  workflowDocumentId: z.string().min(1),
  workflowId: z.string().min(1),
  chunkId: z.string().min(1),
  ticketIntent: ticketIntentSchema,
  codebaseContext: codebaseContextSchema,
  approvedPrd: cursorApprovedPrdSnapshotSchema,
  chunk: cursorChunkSpecSchema,
  conventions: cursorConventionSnapshotSchema,
  guidance: z.object({
    filesToModify: z.array(z.string()),
    namingConventions: z.array(namingConventionSchema),
    designPatterns: z.array(designPatternSchema),
    acceptanceCriteria: z.array(z.string()),
    commitMessageFormat: z.string().min(1),
    branchNamingPattern: z.string().min(1),
  }),
  packagedAt: z.string().datetime(),
});

export type CursorContextDocument = z.infer<typeof cursorContextDocumentSchema>;

export const cursorFileChangeActionSchema = z.enum(['modified', 'created', 'deleted']);
export type CursorFileChangeAction = z.infer<typeof cursorFileChangeActionSchema>;

export const cursorFileChangeSchema = z.object({
  path: z.string().min(1),
  action: cursorFileChangeActionSchema,
  content: z.string().optional(),
});

export type CursorFileChange = z.infer<typeof cursorFileChangeSchema>;

export const cursorImplementationResultSchema = z.object({
  chunkId: z.string().min(1),
  workflowId: z.string().min(1),
  branchName: z.string().min(1).optional(),
  commitMessage: z.string().min(1).optional(),
  fileChanges: z.array(cursorFileChangeSchema),
  newFiles: z.array(z.string()),
  deletedFiles: z.array(z.string()),
  summary: z.string().optional(),
  receivedAt: z.string().datetime().optional(),
});

export type CursorImplementationResult = z.infer<typeof cursorImplementationResultSchema>;

export const cursorScopeValidationSchema = z.object({
  valid: z.boolean(),
  expectedFiles: z.array(z.string()),
  touchedFiles: z.array(z.string()),
  unexpectedFiles: z.array(z.string()),
});

export type CursorScopeValidation = z.infer<typeof cursorScopeValidationSchema>;

export const cursorConventionValidationSchema = z.object({
  valid: z.boolean(),
  branchValid: z.boolean(),
  commitValid: z.boolean(),
  branchNamingPattern: z.string().min(1),
  commitMessageFormat: z.string().min(1),
  issues: z.array(z.string()),
});

export type CursorConventionValidation = z.infer<typeof cursorConventionValidationSchema>;

export const cursorResultValidationSchema = z.object({
  scope: cursorScopeValidationSchema,
  conventions: cursorConventionValidationSchema,
});

export type CursorResultValidation = z.infer<typeof cursorResultValidationSchema>;

export const cursorDeliveryStatusSchema = z.enum(['delivered', 'dry_run', 'queued']);
export type CursorDeliveryStatus = z.infer<typeof cursorDeliveryStatusSchema>;

export const cursorDeliveryAckSchema = z.object({
  deliveryId: z.string().min(1),
  status: cursorDeliveryStatusSchema,
  deliveredAt: z.string().datetime(),
});

export type CursorDeliveryAck = z.infer<typeof cursorDeliveryAckSchema>;

export const cursorExecuteRequestSchema = z.object({
  dryRun: z.boolean().optional(),
});

export type CursorExecuteRequest = z.infer<typeof cursorExecuteRequestSchema>;

export const cursorExecuteResponseSchema = z.object({
  context: cursorContextDocumentSchema,
  delivery: cursorDeliveryAckSchema,
  result: cursorImplementationResultSchema.optional(),
  validation: cursorResultValidationSchema.optional(),
});

export type CursorExecuteResponse = z.infer<typeof cursorExecuteResponseSchema>;

export const cursorContextResponseSchema = z.object({
  context: cursorContextDocumentSchema,
});

export type CursorContextResponse = z.infer<typeof cursorContextResponseSchema>;

export const cursorResultsSubmitRequestSchema = cursorImplementationResultSchema.omit({
  receivedAt: true,
});

export type CursorResultsSubmitRequest = z.infer<typeof cursorResultsSubmitRequestSchema>;

export const cursorResultsSubmitResponseSchema = z.object({
  result: cursorImplementationResultSchema,
  validation: cursorResultValidationSchema,
});

export type CursorResultsSubmitResponse = z.infer<typeof cursorResultsSubmitResponseSchema>;

/** Subset of PRD fields used when packaging without full PrdResponse round-trip. */
export const cursorPrdSourceSchema = prdResponseSchema.pick({
  id: true,
  ticketKey: true,
  ticketIntentId: true,
  version: true,
  status: true,
  sections: true,
  approvedBy: true,
  approvedAt: true,
  owner: true,
  repo: true,
});

export type CursorPrdSource = z.infer<typeof cursorPrdSourceSchema>;
