import { z } from 'zod';
import {
  MAX_REGEXP_PATTERN_LENGTH,
  describeRegExpSafetyIssue,
  findRegExpSafetyIssue,
  isSafeRegExpPattern,
} from './safeRegExp.js';

export const GITHUB_USERNAME_REGEX = /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;

export const githubUsernameSchema = z
  .string()
  .regex(GITHUB_USERNAME_REGEX, 'Invalid GitHub username. Example: octocat');

/** True when the pattern is syntactically valid and passes ReDoS heuristics. */
export function isValidRegexPattern(value: string): boolean {
  return isSafeRegExpPattern(value);
}

export const branchNamingPatternSchema = z
  .string()
  .min(1, 'Branch naming pattern is required')
  .max(
    MAX_REGEXP_PATTERN_LENGTH,
    `Branch naming pattern must be ${MAX_REGEXP_PATTERN_LENGTH} characters or fewer`,
  )
  .superRefine((value, ctx) => {
    const issue = findRegExpSafetyIssue(value);
    if (issue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${describeRegExpSafetyIssue(issue)} Example: ^(feature|bugfix)/OPL-\\d+$`,
      });
    }
  });

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

export const branchNameTemplateSchema = nonEmptyTemplateSchema(
  'Branch name template',
  '{type}/{ticketKey}-{description}',
).refine(
  (value) => value.includes('{ticketKey}'),
  'Branch name template must include {ticketKey}',
);

export const conventionSettingsInputSchema = z.object({
  commitMessageFormat: nonEmptyTemplateSchema(
    'Commit message format',
    'OPL-1234: commit description message',
  ),
  /** Template used to generate branch names — never hardcode names in services. */
  branchNameTemplate: branchNameTemplateSchema.optional(),
  /** Regex used to validate generated branch names. */
  branchNamingPattern: branchNamingPatternSchema,
  prTitleTemplate: nonEmptyTemplateSchema('PR title template', 'OPL-1234 summary of pr'),
  prDescriptionTemplate: nonEmptyTemplateSchema(
    'PR description template',
    'Context\\n{context}\\n\\nChanges in codebase\\n{changes}',
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

export type ConventionSettingsListResponse = z.infer<typeof conventionSettingsListResponseSchema>;

export const conventionDefaultsResponseSchema = z.object({
  templates: conventionSettingsInputSchema,
  availableVariables: z.array(z.string()),
});

export type ConventionDefaultsResponse = z.infer<typeof conventionDefaultsResponseSchema>;

export const conventionHistoryResponseSchema = z.object({
  versions: z.array(conventionSettingsResponseSchema),
});

export type ConventionHistoryResponse = z.infer<typeof conventionHistoryResponseSchema>;

export const conventionSettingsParamsSchema = z.object({
  id: z.string().min(1, 'Convention settings id is required'),
});
