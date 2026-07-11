import {
  conventionSettingsInputSchema,
  isValidRegexPattern,
  reviewerAssignmentRulesSchema,
  type ConventionSettingsInput,
} from '@autodev/shared-types';

export type ConventionSectionId = 'commit' | 'branch' | 'pr' | 'reviewers';

export type ConventionFieldErrors = Partial<
  Record<keyof ConventionSettingsInput | 'reviewers' | 'reviewerAssignmentRules', string>
>;

export function validateConventionForm(input: ConventionSettingsInput): ConventionFieldErrors {
  const result = conventionSettingsInputSchema.safeParse(input);
  if (result.success) {
    return {};
  }

  return mapZodIssuesToFieldErrors(result.error.issues);
}

export function validateConventionSection(
  sectionId: ConventionSectionId,
  input: ConventionSettingsInput,
): ConventionFieldErrors {
  switch (sectionId) {
    case 'commit': {
      const result = conventionSettingsInputSchema
        .pick({ commitMessageFormat: true })
        .safeParse({ commitMessageFormat: input.commitMessageFormat });
      return result.success ? {} : mapZodIssuesToFieldErrors(result.error.issues);
    }
    case 'branch': {
      const errors: ConventionFieldErrors = {};
      const branchError = validateBranchPattern(input.branchNamingPattern);
      if (branchError) {
        errors.branchNamingPattern = branchError;
      }
      return errors;
    }
    case 'pr': {
      const result = conventionSettingsInputSchema
        .pick({ prTitleTemplate: true, prDescriptionTemplate: true })
        .safeParse({
          prTitleTemplate: input.prTitleTemplate,
          prDescriptionTemplate: input.prDescriptionTemplate,
        });
      return result.success ? {} : mapZodIssuesToFieldErrors(result.error.issues);
    }
    case 'reviewers': {
      const result = reviewerAssignmentRulesSchema.safeParse(input.reviewerAssignmentRules);
      if (result.success) {
        return {};
      }
      const errors = mapZodIssuesToFieldErrors(result.error.issues);
      if (Object.keys(errors).length === 0) {
        errors.reviewerAssignmentRules = result.error.issues[0]?.message ?? 'Invalid reviewer rules.';
      }
      return errors;
    }
  }
}

export function mergeSectionIntoSettings(
  baseline: ConventionSettingsInput,
  sectionId: ConventionSectionId,
  input: ConventionSettingsInput,
): ConventionSettingsInput {
  switch (sectionId) {
    case 'commit':
      return { ...baseline, commitMessageFormat: input.commitMessageFormat };
    case 'branch':
      return { ...baseline, branchNamingPattern: input.branchNamingPattern };
    case 'pr':
      return {
        ...baseline,
        prTitleTemplate: input.prTitleTemplate,
        prDescriptionTemplate: input.prDescriptionTemplate,
      };
    case 'reviewers':
      return { ...baseline, reviewerAssignmentRules: input.reviewerAssignmentRules };
  }
}

export function validateBranchPattern(value: string): string | undefined {
  if (!value.trim()) {
    return 'Branch naming pattern is required';
  }
  if (!isValidRegexPattern(value)) {
    return 'Branch naming pattern must be valid regex. Example: ^(feature|bugfix)/OPL-\\d+$';
  }
  return undefined;
}

function mapZodIssuesToFieldErrors(
  issues: Array<{ path: PropertyKey[]; message: string }>,
): ConventionFieldErrors {
  const errors: ConventionFieldErrors = {};

  for (const issue of issues) {
    const path = issue.path.join('.');
    if (path.startsWith('reviewerAssignmentRules.reviewers') || path === 'reviewers') {
      errors.reviewers = issue.message;
    } else if (path.startsWith('reviewerAssignmentRules')) {
      errors.reviewerAssignmentRules = issue.message;
    } else {
      const key = issue.path[0];
      if (typeof key === 'string') {
        errors[key as keyof ConventionSettingsInput] = issue.message;
      }
    }
  }

  return errors;
}
