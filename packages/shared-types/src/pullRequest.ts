import { z } from 'zod';
import { githubRateLimitStatusSchema } from './repositories.js';

export const PR_CHANGE_TYPES = ['feature', 'bugfix', 'refactor', 'documentation'] as const;
export const prChangeTypeSchema = z.enum(PR_CHANGE_TYPES);
export type PrChangeType = z.infer<typeof prChangeTypeSchema>;

export const LABEL_BY_CHANGE_TYPE: Record<PrChangeType, string> = {
  feature: 'feature',
  bugfix: 'bugfix',
  refactor: 'refactor',
  documentation: 'documentation',
};

export const createPullRequestRequestSchema = z.object({
  changeType: prChangeTypeSchema.optional(),
  headBranch: z.string().min(1).max(255).optional(),
  baseBranch: z.string().min(1).max(255).optional(),
});

export type CreatePullRequestRequest = z.infer<typeof createPullRequestRequestSchema>;

export const pullRequestResponseSchema = z.object({
  workflowDocumentId: z.string().min(1),
  workflowId: z.string().min(1),
  ticketKey: z.string().min(1),
  prNumber: z.number().int().positive(),
  prUrl: z.string().url(),
  title: z.string().min(1),
  body: z.string().min(1),
  labels: z.array(z.string()),
  reviewers: z.array(z.string()),
  changeType: prChangeTypeSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  headBranch: z.string().min(1),
  baseBranch: z.string().min(1),
  rateLimitWarning: z.string().optional(),
  rateLimit: githubRateLimitStatusSchema.optional(),
  created: z.boolean(),
});

export type PullRequestResponse = z.infer<typeof pullRequestResponseSchema>;

export function labelForChangeType(changeType: PrChangeType): string {
  return LABEL_BY_CHANGE_TYPE[changeType];
}
