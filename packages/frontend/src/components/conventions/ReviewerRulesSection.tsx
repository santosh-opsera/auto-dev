import type { ConventionSettingsInput } from '@autodev/shared-types';

type ReviewerMode = ConventionSettingsInput['reviewerAssignmentRules']['mode'];

interface ReviewerRulesSectionProps {
  rules: ConventionSettingsInput['reviewerAssignmentRules'];
  onChange: (rules: ConventionSettingsInput['reviewerAssignmentRules']) => void;
  error?: string;
  reviewersError?: string;
}

const MODES: Array<{ value: ReviewerMode; label: string; description: string }> = [
  {
    value: 'round-robin',
    label: 'Round robin',
    description: 'Rotate reviewers from a fixed list for each pull request.',
  },
  {
    value: 'code-owner-based',
    label: 'Code owner based',
    description: 'Use repository CODEOWNERS to determine reviewers automatically.',
  },
  {
    value: 'manual-list',
    label: 'Manual list',
    description: 'Assign reviewers from a list you maintain.',
  },
];

export function ReviewerRulesSection({
  rules,
  onChange,
  error,
  reviewersError,
}: ReviewerRulesSectionProps) {
  const showReviewers = rules.mode === 'round-robin' || rules.mode === 'manual-list';
  const reviewers = 'reviewers' in rules ? (rules.reviewers ?? []).join(', ') : '';

  return (
    <fieldset className="reviewer-rules-section">
      <legend>Reviewer assignment rules</legend>
      <div className="reviewer-mode-options" role="radiogroup" aria-label="Reviewer assignment mode">
        {MODES.map((mode) => (
          <label key={mode.value} className="reviewer-mode-option">
            <input
              type="radio"
              name="reviewer-mode"
              value={mode.value}
              checked={rules.mode === mode.value}
              onChange={() => {
                if (mode.value === 'code-owner-based') {
                  onChange({ mode: 'code-owner-based' });
                  return;
                }
                onChange({
                  mode: mode.value,
                  reviewers: 'reviewers' in rules ? rules.reviewers : ['octocat'],
                });
              }}
            />
            <span>
              <strong>{mode.label}</strong>
              <span className="field-hint">{mode.description}</span>
            </span>
          </label>
        ))}
      </div>

      {showReviewers ? (
        <div className="convention-field">
          <label htmlFor="reviewer-list">Reviewers (GitHub usernames, comma-separated)</label>
          <input
            id="reviewer-list"
            type="text"
            className={reviewersError ? 'field-input field-input-error' : 'field-input'}
            value={reviewers}
            aria-invalid={reviewersError ? true : undefined}
            aria-describedby={reviewersError ? 'reviewer-list-error' : undefined}
            onChange={(event) => {
              const nextReviewers = event.target.value
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
              onChange({
                mode: rules.mode as 'round-robin' | 'manual-list',
                reviewers: nextReviewers,
              });
            }}
          />
          {reviewersError ? (
            <p id="reviewer-list-error" className="field-error" role="alert">
              {reviewersError}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
