import { z } from 'zod';
import { repositoryNameSchema, repositoryOwnerSchema } from './repositories.js';
import { ticketKeySchema } from './tickets.js';

/** Target budget for PRD generation including LLM round-trip. */
export const PRD_GENERATION_TIMEOUT_MS = 30_000;

export const prdStatusSchema = z.enum(['draft', 'in_review', 'approved', 'rejected']);
export type PrdStatus = z.infer<typeof prdStatusSchema>;

export const prdSectionsSchema = z.object({
  problemStatement: z.string().min(1),
  solutionOutline: z.string().min(1),
  userStories: z.array(z.string().min(1)).min(1),
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
  scopeBoundaries: z.array(z.string().min(1)).min(1),
  dependencies: z.array(z.string()),
  risks: z.array(z.string().min(1)).min(1),
  successMetrics: z.array(z.string().min(1)).min(1),
});

export type PrdSections = z.infer<typeof prdSectionsSchema>;

export const prdCodebaseContextSummarySchema = z.object({
  affectedModules: z.array(z.string()),
  applicablePatterns: z.array(z.string()),
  integrationPoints: z.array(z.string()),
});

export type PrdCodebaseContextSummary = z.infer<typeof prdCodebaseContextSummarySchema>;

export const prdGenerateRequestSchema = z.object({
  workflowId: z.string().min(1).optional(),
  approvalRequestId: z.string().min(1).optional(),
  owner: repositoryOwnerSchema.optional(),
  repo: repositoryNameSchema.optional(),
});

export type PrdGenerateRequest = z.infer<typeof prdGenerateRequestSchema>;

export const prdCreateVersionRequestSchema = z.object({
  sections: prdSectionsSchema,
  status: prdStatusSchema.optional(),
});

export type PrdCreateVersionRequest = z.infer<typeof prdCreateVersionRequestSchema>;

export const prdRejectRequestSchema = z.object({
  reason: z.string().trim().min(1, 'Rejection reason is required'),
});

export type PrdRejectRequest = z.infer<typeof prdRejectRequestSchema>;

export const prdIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const prdResponseSchema = z.object({
  id: z.string().min(1),
  ticketKey: ticketKeySchema,
  ticketIntentId: z.string().min(1),
  approvalRequestId: z.string().min(1).optional(),
  workflowId: z.string().min(1).optional(),
  owner: repositoryOwnerSchema.optional(),
  repo: repositoryNameSchema.optional(),
  version: z.number().int().positive(),
  previousVersionId: z.string().min(1).optional(),
  status: prdStatusSchema,
  isActive: z.boolean(),
  sections: prdSectionsSchema,
  codebaseContext: prdCodebaseContextSummarySchema,
  approvedBy: z.string().min(1).optional(),
  approvedAt: z.string().datetime().optional(),
  rejectedBy: z.string().min(1).optional(),
  rejectedAt: z.string().datetime().optional(),
  rejectionReason: z.string().min(1).optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PrdResponse = z.infer<typeof prdResponseSchema>;

/** Stable section keys for review UI and version diffs. */
export const PRD_SECTION_KEYS = [
  'problemStatement',
  'solutionOutline',
  'userStories',
  'acceptanceCriteria',
  'scopeBoundaries',
  'dependencies',
  'risks',
  'successMetrics',
] as const satisfies ReadonlyArray<keyof PrdSections>;

export type PrdSectionKey = (typeof PRD_SECTION_KEYS)[number];

export const PRD_SECTION_LABELS: Record<PrdSectionKey, string> = {
  problemStatement: 'Problem statement',
  solutionOutline: 'Solution outline',
  userStories: 'User stories',
  acceptanceCriteria: 'Acceptance criteria',
  scopeBoundaries: 'Scope boundaries',
  dependencies: 'Dependencies',
  risks: 'Risks',
  successMetrics: 'Success metrics',
};

export function formatPrdSectionValue(value: string | string[]): string {
  return Array.isArray(value) ? value.join('\n') : value;
}

export const prdListResponseSchema = z.object({
  prds: z.array(prdResponseSchema),
});

export type PrdListResponse = z.infer<typeof prdListResponseSchema>;

/**
 * Escape HTML entities so AI-generated PRD content is XSS-safe when rendered.
 */
export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function encodePrdSections(sections: PrdSections): PrdSections {
  return {
    problemStatement: escapeHtml(sections.problemStatement),
    solutionOutline: escapeHtml(sections.solutionOutline),
    userStories: sections.userStories.map(escapeHtml),
    acceptanceCriteria: sections.acceptanceCriteria.map(escapeHtml),
    scopeBoundaries: sections.scopeBoundaries.map(escapeHtml),
    dependencies: sections.dependencies.map(escapeHtml),
    risks: sections.risks.map(escapeHtml),
    successMetrics: sections.successMetrics.map(escapeHtml),
  };
}
