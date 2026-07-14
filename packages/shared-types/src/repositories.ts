import { z } from 'zod';

export const repositoryOwnerSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]+$/, 'Repository owner must contain only letters, numbers, and hyphens.');

export const repositoryNameSchema = z
  .string()
  .regex(/^[A-Za-z0-9._-]+$/, 'Repository name must contain only letters, numbers, dots, underscores, and hyphens.');

export const repositoryParamsSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
});

export const repositoryFileParamsSchema = repositoryParamsSchema.extend({
  path: z.string().min(1),
});

export const githubRepositorySchema = z.object({
  id: z.number().int(),
  name: repositoryNameSchema,
  fullName: z.string(),
  owner: z.string(),
  private: z.boolean(),
  defaultBranch: z.string(),
  htmlUrl: z.string().url(),
});

export type GitHubRepository = z.infer<typeof githubRepositorySchema>;

export const githubRateLimitStatusSchema = z.object({
  limit: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  resetAt: z.string().datetime(),
  queuedRequests: z.number().int().nonnegative(),
});

export type GitHubRateLimitStatus = z.infer<typeof githubRateLimitStatusSchema>;

export const repositoryListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  q: z.string().trim().max(200).optional(),
});

export type RepositoryListQuery = z.infer<typeof repositoryListQuerySchema>;

export const repositoryPaginationSchema = z.object({
  page: z.number().int().min(1),
  perPage: z.number().int().min(1).max(100),
  totalCount: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
});

export type RepositoryPagination = z.infer<typeof repositoryPaginationSchema>;

export const repositoryListResponseSchema = z.object({
  repositories: z.array(githubRepositorySchema),
  pagination: repositoryPaginationSchema,
  rateLimitWarning: z.string().optional(),
  rateLimit: githubRateLimitStatusSchema.optional(),
});

export type RepositoryListResponse = z.infer<typeof repositoryListResponseSchema>;

export const repositoryConnectionSchema = z.object({
  id: z.string(),
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  fullName: z.string(),
  defaultBranch: z.string(),
  connectedAt: z.string().datetime(),
});

export type RepositoryConnection = z.infer<typeof repositoryConnectionSchema>;

export const repositoryConnectResponseSchema = z.object({
  connection: repositoryConnectionSchema,
});

export type RepositoryConnectResponse = z.infer<typeof repositoryConnectResponseSchema>;

export const connectedRepositoryListResponseSchema = z.object({
  connections: z.array(repositoryConnectionSchema),
});

export type ConnectedRepositoryListResponse = z.infer<typeof connectedRepositoryListResponseSchema>;

export const repositoryTreeEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'dir']),
  sha: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export type RepositoryTreeEntry = z.infer<typeof repositoryTreeEntrySchema>;

export const repositoryTreeResponseSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  branch: z.string(),
  tree: z.array(repositoryTreeEntrySchema),
});

export type RepositoryTreeResponse = z.infer<typeof repositoryTreeResponseSchema>;

export const repositoryFileResponseSchema = z.object({
  owner: repositoryOwnerSchema,
  repo: repositoryNameSchema,
  path: z.string(),
  encoding: z.enum(['base64', 'utf-8']),
  content: z.string(),
  sha: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
});

export type RepositoryFileResponse = z.infer<typeof repositoryFileResponseSchema>;
