import { describe, expect, it } from 'vitest';
import { WIZARD_STEPS } from '../components/conventions/ConventionSetupWizard';
import { insertTemplateVariable, previewBranchName } from './templateVariables';

describe('insertTemplateVariable', () => {
  it('appends a variable token when no selection is provided', () => {
    expect(insertTemplateVariable('feat:', 'ticketKey')).toBe('feat:{ticketKey}');
  });

  it('inserts a variable token at the cursor position', () => {
    expect(insertTemplateVariable('[] summary', 'ticketKey', 1, 1)).toBe('[{ticketKey}] summary');
  });
});

describe('previewBranchName', () => {
  it('returns a matching sample branch for valid regex patterns', () => {
    expect(previewBranchName('^(feature|bugfix)/OPL-\\d+$')).toContain('feature/OPL-');
  });

  it('returns an invalid regex message for bad patterns', () => {
    expect(previewBranchName('[invalid')).toContain('Invalid regex');
  });
});

describe('wizard steps', () => {
  it('defines the expected setup flow', () => {
    expect(WIZARD_STEPS.map((step) => step.id)).toEqual(['commit', 'branch', 'pr', 'reviewers']);
  });
});
