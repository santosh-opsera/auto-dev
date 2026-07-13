import { z } from 'zod';
import { implementationChunkResponseSchema } from './chunk.js';

export const createChunkBranchRequestSchema = z.object({
  type: z.string().min(1).max(64).optional(),
  description: z.string().min(1).max(200).optional(),
});

export type CreateChunkBranchRequest = z.infer<typeof createChunkBranchRequestSchema>;

export const commitChunkFileSchema = z.object({
  path: z.string().min(1).max(500),
  content: z.string(),
  encoding: z.enum(['utf-8', 'base64']).optional(),
});

export type CommitChunkFile = z.infer<typeof commitChunkFileSchema>;

export const commitChunkRequestSchema = z.object({
  message: z.string().min(1).max(2000).optional(),
  files: z.array(commitChunkFileSchema).min(1).optional(),
});

export type CommitChunkRequest = z.infer<typeof commitChunkRequestSchema>;

export const branchPreviewQuerySchema = z.object({
  type: z.string().min(1).max(64).optional(),
  description: z.string().min(1).max(200).optional(),
});

export type BranchPreviewQuery = z.infer<typeof branchPreviewQuerySchema>;

export const commitPreviewQuerySchema = z.object({
  description: z.string().min(1).max(200).optional(),
});

export type CommitPreviewQuery = z.infer<typeof commitPreviewQuerySchema>;

export const chunkBranchResponseSchema = z.object({
  chunk: implementationChunkResponseSchema,
  branchName: z.string().min(1),
  baseBranch: z.string().min(1),
  headSha: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  created: z.boolean(),
});

export type ChunkBranchResponse = z.infer<typeof chunkBranchResponseSchema>;

export const chunkCommitResponseSchema = z.object({
  chunk: implementationChunkResponseSchema,
  branchName: z.string().min(1),
  commitSha: z.string().min(1),
  commitMessage: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  filesCommitted: z.array(z.string()),
  readyForPr: z.boolean(),
});

export type ChunkCommitResponse = z.infer<typeof chunkCommitResponseSchema>;

export const branchNamePreviewResponseSchema = z.object({
  branchName: z.string().min(1),
  branchNameTemplate: z.string().min(1),
  branchNamingPattern: z.string().min(1),
  valid: z.boolean(),
  ticketKey: z.string().min(1),
});

export type BranchNamePreviewResponse = z.infer<typeof branchNamePreviewResponseSchema>;

export const commitMessagePreviewResponseSchema = z.object({
  commitMessage: z.string().min(1),
  commitMessageFormat: z.string().min(1),
  valid: z.boolean(),
  ticketKey: z.string().min(1),
});

export type CommitMessagePreviewResponse = z.infer<typeof commitMessagePreviewResponseSchema>;
