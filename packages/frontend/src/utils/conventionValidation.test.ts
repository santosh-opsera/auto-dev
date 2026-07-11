import { describe, expect, it } from 'vitest';
import { mockConventionInput } from '../fixtures/conventions';
import {
  mergeSectionIntoSettings,
  validateBranchPattern,
  validateConventionForm,
  validateConventionSection,
} from './conventionValidation';

describe('validateConventionForm', () => {
  it('returns no errors for valid convention input', () => {
    expect(validateConventionForm(mockConventionInput)).toEqual({});
  });

  it('returns field errors for invalid input', () => {
    const errors = validateConventionForm({
      ...mockConventionInput,
      commitMessageFormat: '',
      branchNamingPattern: '[invalid',
      reviewerAssignmentRules: {
        mode: 'manual-list',
        reviewers: ['not valid!'],
      },
    });

    expect(errors.commitMessageFormat).toBeTruthy();
    expect(errors.branchNamingPattern).toBeTruthy();
    expect(errors.reviewers).toBeTruthy();
  });
});

describe('validateConventionSection', () => {
  it('validates only the commit section', () => {
    const errors = validateConventionSection('commit', {
      ...mockConventionInput,
      commitMessageFormat: '',
      branchNamingPattern: '[invalid',
    });

    expect(errors.commitMessageFormat).toBeTruthy();
    expect(errors.branchNamingPattern).toBeUndefined();
  });

  it('validates only the reviewers section', () => {
    const errors = validateConventionSection('reviewers', {
      ...mockConventionInput,
      reviewerAssignmentRules: {
        mode: 'manual-list',
        reviewers: ['not valid!'],
      },
    });

    expect(errors.reviewers).toBeTruthy();
    expect(errors.commitMessageFormat).toBeUndefined();
  });
});

describe('mergeSectionIntoSettings', () => {
  it('updates only the saved section against the persisted baseline', () => {
    const baseline = mockConventionInput;
    const merged = mergeSectionIntoSettings(baseline, 'reviewers', {
      ...baseline,
      commitMessageFormat: 'local unsaved commit',
      reviewerAssignmentRules: {
        mode: 'manual-list',
        reviewers: ['hubot'],
      },
    });

    expect(merged.commitMessageFormat).toBe(baseline.commitMessageFormat);
    expect(merged.reviewerAssignmentRules).toEqual({
      mode: 'manual-list',
      reviewers: ['hubot'],
    });
  });
});

describe('validateBranchPattern', () => {
  it('accepts valid regex patterns', () => {
    expect(validateBranchPattern('^(feature|bugfix)/OPL-\\d+$')).toBeUndefined();
  });

  it('rejects invalid regex patterns', () => {
    expect(validateBranchPattern('[invalid')).toContain('Example:');
  });
});
