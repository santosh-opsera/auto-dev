import { z } from 'zod';

export const GITHUB_USERNAME_REGEX = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export const githubUsernameSchema = z
  .string()
  .regex(GITHUB_USERNAME_REGEX, 'Invalid GitHub username. Example: octocat');

export function isValidRegexPattern(value: string): boolean {
  if (value.length > 200) {
    return false;
  }
  try {
    RegExp(value);
    return true;
  } catch {
    return false;
  }
}

export const branchNamingPatternSchema = z
  .string()
  .min(1, 'Branch naming pattern is required')
  .max(200, 'Branch naming pattern must be 200 characters or fewer')
  .refine(
    isValidRegexPattern,
    'Branch naming pattern must be valid regex. Example: ^feature/[A-Z]+-\\d+$',
  );

export const nonEmptyTemplateSchema = (field: string, example: string) =>
  z.string().min(1, `${field} is required. Example: ${example}`);

export const reviewerAssignmentRulesSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('round-robin'),
    reviewers: z.array(githubUsernameSchema).min(1, 'At least one reviewer is required'),
  }),
  z.object({
    mode: z.literal('code-owner-based'),
  }),
  z.object({
    mode: z.literal('manual-list'),
    reviewers: z.array(githubUsernameSchema).min(1, 'At least one reviewer is required'),
  }),
]);

export const conventionSettingsInputSchema = z.object({
  commitMessageFormat: nonEmptyTemplateSchema(
    'Commit message format',
    '{type}({scope}): {description} [{ticketKey}]',
  ),
  branchNamingPattern: branchNamingPatternSchema,
  prTitleTemplate: nonEmptyTemplateSchema('PR title template', '[{ticketKey}] {summary}'),
  prDescriptionTemplate: nonEmptyTemplateSchema(
    'PR description template',
    '## Summary\\n{summary}',
  ),
  reviewerAssignmentRules: reviewerAssignmentRulesSchema,
});

export type ConventionSettingsInput = z.infer<typeof conventionSettingsInputSchema>;

export const conventionSettingsResponseSchema = conventionSettingsInputSchema.extend({
  id: z.string(),
  userId: z.string(),
  version: z.number().int().positive(),
  isActive: z.boolean(),
  previousVersionId: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type ConventionSettingsResponse = z.infer<typeof conventionSettingsResponseSchema>;

export const conventionSettingsListResponseSchema = z.object({
  settings: conventionSettingsResponseSchema.nullable(),
});

export const conventionHistoryResponseSchema = z.object({
  versions: z.array(conventionSettingsResponseSchema),
});

export const conventionDefaultsResponseSchema = z.object({
  templates: conventionSettingsInputSchema,
  availableVariables: z.array(z.string()),
});

export const conventionSettingsParamsSchema = z.object({
  id: z.string().min(1, 'Convention settings id is required'),
});
