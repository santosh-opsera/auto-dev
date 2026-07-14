import type { ConventionSettingsInput } from '@autodev/shared-types';
import { ConventionField } from './ConventionField';
import { ReviewerRulesSection } from './ReviewerRulesSection';
import { previewBranchName } from '../../utils/templateVariables';
import type { ConventionFieldErrors, ConventionSectionId } from '../../utils/conventionValidation';

export type { ConventionSectionId };

export interface WizardStep {
  id: string;
  title: string;
  description: string;
}

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'commit',
    title: 'Commit messages',
    description: 'Define how commit messages should be formatted for every change.',
  },
  {
    id: 'branch',
    title: 'Branch naming',
    description: 'Set a regex pattern that branch names must match.',
  },
  {
    id: 'pr',
    title: 'Pull request templates',
    description: 'Configure PR title and description templates.',
  },
  {
    id: 'reviewers',
    title: 'Reviewer assignment',
    description: 'Choose how reviewers are assigned to pull requests.',
  },
];

interface ConventionSetupWizardProps {
  stepIndex: number;
  form: ConventionSettingsInput;
  errors: ConventionFieldErrors;
  variables: string[];
  onChange: (form: ConventionSettingsInput) => void;
  onStepChange: (index: number) => void;
  onSubmit: (sectionId: ConventionSectionId) => void;
  isSubmitting: boolean;
  isFirstTime: boolean;
}

function SaveButton({
  isSubmitting,
  onSubmit,
}: {
  isSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="wizard-actions">
      <button type="button" className="primary-button" disabled={isSubmitting} onClick={onSubmit}>
        {isSubmitting ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

export function ConventionSetupWizard({
  stepIndex,
  form,
  errors,
  variables,
  onChange,
  onStepChange,
  onSubmit,
  isSubmitting,
  isFirstTime,
}: ConventionSetupWizardProps) {
  const step = WIZARD_STEPS[stepIndex];
  const branchPreview = previewBranchName(form.branchNamingPattern);

  return (
    <section className="convention-wizard" aria-labelledby="wizard-heading">
      <header className="wizard-header">
        <h2 id="wizard-heading">{isFirstTime ? 'Convention setup wizard' : 'Update conventions'}</h2>
        <p>{step.description}</p>
        <div className="wizard-steps" role="tablist" aria-label="Convention setup sections">
          {WIZARD_STEPS.map((wizardStep, index) => (
            <button
              key={wizardStep.id}
              type="button"
              role="tab"
              className={index === stepIndex ? 'wizard-step active' : 'wizard-step'}
              aria-selected={index === stepIndex}
              aria-controls={`wizard-panel-${wizardStep.id}`}
              id={`wizard-tab-${wizardStep.id}`}
              onClick={() => onStepChange(index)}
            >
              {wizardStep.title}
            </button>
          ))}
        </div>
      </header>

      <div
        role="tabpanel"
        id={`wizard-panel-${step.id}`}
        aria-labelledby={`wizard-tab-${step.id}`}
      >
        {step.id === 'commit' ? (
          <>
            <ConventionField
              id="commit-message-format"
              label="Commit message format"
              hint="Example: OPL-1234: commit description message"
              value={form.commitMessageFormat}
              onChange={(commitMessageFormat) => onChange({ ...form, commitMessageFormat })}
              error={errors.commitMessageFormat}
              variables={variables}
            />
            <SaveButton isSubmitting={isSubmitting} onSubmit={() => onSubmit('commit')} />
          </>
        ) : null}

        {step.id === 'branch' ? (
          <>
            <ConventionField
              id="branch-naming-pattern"
              label="Branch naming pattern (regex)"
              hint="Suggested pattern: feature/OPL-1234 or bugfix/OPL-1234"
              value={form.branchNamingPattern}
              onChange={(branchNamingPattern) => onChange({ ...form, branchNamingPattern })}
              error={errors.branchNamingPattern}
              preview={
                <p className="branch-preview" aria-live="polite">
                  <strong>Preview:</strong> {branchPreview}
                </p>
              }
            />
            <SaveButton isSubmitting={isSubmitting} onSubmit={() => onSubmit('branch')} />
          </>
        ) : null}

        {step.id === 'pr' ? (
          <>
            <ConventionField
              id="pr-title-template"
              label="PR title template"
              hint="Suggested pattern: OPL-1234 summary of pr"
              value={form.prTitleTemplate}
              onChange={(prTitleTemplate) => onChange({ ...form, prTitleTemplate })}
              error={errors.prTitleTemplate}
              variables={variables}
            />
            <ConventionField
              id="pr-description-template"
              label="PR description template"
              hint="Suggested pattern: Context, Changes in codebase, and Jira Ticket sections"
              value={form.prDescriptionTemplate}
              onChange={(prDescriptionTemplate) => onChange({ ...form, prDescriptionTemplate })}
              error={errors.prDescriptionTemplate}
              variables={variables}
              multiline
            />
            <SaveButton isSubmitting={isSubmitting} onSubmit={() => onSubmit('pr')} />
          </>
        ) : null}

        {step.id === 'reviewers' ? (
          <>
            <ReviewerRulesSection
              rules={form.reviewerAssignmentRules}
              onChange={(reviewerAssignmentRules) => onChange({ ...form, reviewerAssignmentRules })}
              error={errors.reviewerAssignmentRules}
              reviewersError={errors.reviewers}
            />
            <SaveButton isSubmitting={isSubmitting} onSubmit={() => onSubmit('reviewers')} />
          </>
        ) : null}
      </div>
    </section>
  );
}
