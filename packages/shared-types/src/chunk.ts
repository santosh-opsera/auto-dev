import { z } from 'zod';

export const CHUNK_STATUSES = [
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
  'FAILED',
  'PAUSED',
  'SKIPPED',
] as const;

export const chunkStatusSchema = z.enum(CHUNK_STATUSES);
export type ChunkStatus = z.infer<typeof chunkStatusSchema>;

export const CHUNK_COMPLEXITIES = ['low', 'medium', 'high'] as const;
export const chunkComplexitySchema = z.enum(CHUNK_COMPLEXITIES);
export type ChunkComplexity = z.infer<typeof chunkComplexitySchema>;

export const chunkScopeSchema = z.object({
  files: z.array(z.string()),
  modules: z.array(z.string()),
});

export type ChunkScope = z.infer<typeof chunkScopeSchema>;

export const chunkDecomposeRequestSchema = z.object({
  prdId: z.string().min(1),
});

export type ChunkDecomposeRequest = z.infer<typeof chunkDecomposeRequestSchema>;

export const chunkStatusUpdateRequestSchema = z.object({
  status: chunkStatusSchema,
});

export type ChunkStatusUpdateRequest = z.infer<typeof chunkStatusUpdateRequestSchema>;

export const workflowChunkParamsSchema = z.object({
  id: z.string().min(1),
});

export const workflowChunkIdParamsSchema = z.object({
  id: z.string().min(1),
  chunkId: z.string().min(1),
});

export const BRANCH_GIT_STATUSES = [
  'none',
  'branch_created',
  'committed',
  'ready_for_pr',
] as const;

export const branchGitStatusSchema = z.enum(BRANCH_GIT_STATUSES);
export type BranchGitStatus = z.infer<typeof branchGitStatusSchema>;

export const implementationChunkResponseSchema = z.object({
  id: z.string().min(1),
  workflowDocumentId: z.string().min(1),
  workflowId: z.string().min(1),
  prdId: z.string().min(1),
  order: z.number().int().nonnegative(),
  name: z.string().min(1),
  description: z.string().min(1),
  scope: chunkScopeSchema,
  dependencies: z.array(z.string()),
  estimatedComplexity: chunkComplexitySchema,
  status: chunkStatusSchema,
  branchName: z.string().min(1).optional(),
  branchHeadSha: z.string().min(1).optional(),
  lastCommitSha: z.string().min(1).optional(),
  lastCommitMessage: z.string().min(1).optional(),
  gitStatus: branchGitStatusSchema.optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ImplementationChunkResponse = z.infer<typeof implementationChunkResponseSchema>;

export const chunkListResponseSchema = z.object({
  chunks: z.array(implementationChunkResponseSchema),
});

export type ChunkListResponse = z.infer<typeof chunkListResponseSchema>;

/** LLM decomposition draft before persistence (tempIds for dependency wiring). */
export const chunkDecompositionDraftSchema = z.object({
  chunks: z
    .array(
      z.object({
        tempId: z.string().min(1),
        name: z.string().min(1),
        description: z.string().min(1),
        scope: chunkScopeSchema,
        dependsOn: z.array(z.string()),
        estimatedComplexity: chunkComplexitySchema,
      }),
    )
    .min(1),
});

export type ChunkDecompositionDraft = z.infer<typeof chunkDecompositionDraftSchema>;

/** Status transitions allowed for ImplementationChunk documents. */
export const CHUNK_STATUS_TRANSITIONS: Readonly<
  Record<ChunkStatus, readonly ChunkStatus[]>
> = {
  PENDING: ['IN_PROGRESS', 'SKIPPED', 'PAUSED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'PAUSED', 'SKIPPED'],
  PAUSED: ['IN_PROGRESS', 'SKIPPED', 'FAILED'],
  FAILED: ['IN_PROGRESS', 'SKIPPED'],
  COMPLETED: [],
  SKIPPED: [],
};

export function canTransitionChunkStatus(from: ChunkStatus, to: ChunkStatus): boolean {
  return CHUNK_STATUS_TRANSITIONS[from].includes(to);
}
