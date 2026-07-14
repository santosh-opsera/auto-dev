import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConventionSettingsInput } from '@autodev/shared-types';
import { ConventionHistoryPanel } from '../components/conventions/ConventionHistoryPanel';
import {
  ConventionSetupWizard,
  WIZARD_STEPS,
  type ConventionSectionId,
} from '../components/conventions/ConventionSetupWizard';
import { useConventionSettings } from '../hooks/useConventionSettings';
import {
  mergeSectionIntoSettings,
  validateConventionSection,
} from '../utils/conventionValidation';

type Tab = 'configure' | 'history';

const SECTION_LABELS: Record<ConventionSectionId, string> = {
  commit: 'Commit message settings',
  branch: 'Branch naming settings',
  pr: 'Pull request template settings',
  reviewers: 'Reviewer assignment settings',
};

export function ConventionsPage() {
  const { active, defaults, history, loading, error, save, initialForm, isFirstTime } =
    useConventionSettings();
  const [tab, setTab] = useState<Tab>('configure');
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<ConventionSettingsInput | null>(null);
  const [persistedForm, setPersistedForm] = useState<ConventionSettingsInput | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const autoSavedRef = useRef(false);

  const currentSectionId = WIZARD_STEPS[stepIndex]?.id as ConventionSectionId;

  useEffect(() => {
    if (!loading) {
      setPersistedForm(initialForm);
    }
  }, [initialForm, loading]);

  useEffect(() => {
    if (!loading && form === null) {
      setForm(initialForm);
    }
  }, [form, initialForm, loading]);

  useEffect(() => {
    if (loading || !isFirstTime || !defaults || autoSavedRef.current) {
      return;
    }

    autoSavedRef.current = true;
    void (async () => {
      try {
        await save(defaults.templates);
        setPersistedForm(defaults.templates);
        setSaveSuccess('Default conventions saved.');
        setSubmitError(null);
      } catch (saveError) {
        autoSavedRef.current = false;
        setSubmitError(
          saveError instanceof Error ? saveError.message : 'Failed to save default conventions.',
        );
      }
    })();
  }, [defaults, isFirstTime, loading, save]);

  const currentForm = form ?? initialForm;
  const variables = defaults?.availableVariables ?? [];
  const savedBaseline = persistedForm ?? initialForm;

  const errors = useMemo(
    () => validateConventionSection(currentSectionId, currentForm),
    [currentForm, currentSectionId],
  );

  const handleSubmitSection = async (sectionId: ConventionSectionId): Promise<void> => {
    const validationErrors = validateConventionSection(sectionId, currentForm);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Fix validation errors before saving.');
      setSaveSuccess(null);
      return;
    }

    const payload = mergeSectionIntoSettings(savedBaseline, sectionId, currentForm);

    setIsSubmitting(true);
    setSubmitError(null);
    setSaveSuccess(null);
    try {
      await save(payload);
      setPersistedForm(payload);
      setForm((previous) => mergeSectionIntoSettings(payload, sectionId, previous ?? currentForm));
      setSaveSuccess(`${SECTION_LABELS[sectionId]} saved.`);
    } catch (saveError) {
      setSubmitError(saveError instanceof Error ? saveError.message : 'Failed to save conventions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="conventions-page" aria-live="polite">
        <p>Loading convention settings…</p>
      </main>
    );
  }

  return (
    <main className="conventions-page">
      <header className="dashboard-header">
        <div>
          <h1>Convention settings</h1>
          <p>
            {isFirstTime
              ? 'Configure team conventions before starting development workflows.'
              : 'Update conventions or review version history.'}
          </p>
        </div>
        <nav aria-label="Convention page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
        </nav>
      </header>

      {error ? (
        <p className="page-error" role="alert">
          {error}
        </p>
      ) : null}

      {!isFirstTime ? (
        <div className="convention-tabs" role="tablist" aria-label="Convention views">
          <button
            type="button"
            role="tab"
            id="tab-configure"
            aria-selected={tab === 'configure'}
            aria-controls="panel-configure"
            className={tab === 'configure' ? 'tab active' : 'tab'}
            onClick={() => setTab('configure')}
          >
            Configure
          </button>
          <button
            type="button"
            role="tab"
            id="tab-history"
            aria-selected={tab === 'history'}
            aria-controls="panel-history"
            className={tab === 'history' ? 'tab active' : 'tab'}
            onClick={() => setTab('history')}
          >
            Version history
          </button>
        </div>
      ) : null}

      {tab === 'configure' || isFirstTime ? (
        <div role="tabpanel" id="panel-configure" aria-labelledby="tab-configure">
          <ConventionSetupWizard
            stepIndex={stepIndex}
            form={currentForm}
            errors={errors}
            variables={variables}
            onChange={(nextForm) => setForm(nextForm)}
            onStepChange={setStepIndex}
            onSubmit={(sectionId) => void handleSubmitSection(sectionId)}
            isSubmitting={isSubmitting}
            isFirstTime={isFirstTime}
          />
          {saveSuccess ? (
            <p className="save-success" role="status">
              {saveSuccess}
            </p>
          ) : null}
          {submitError ? (
            <p className="page-error" role="alert">
              {submitError}
            </p>
          ) : null}
          {active ? (
            <p className="field-hint">Saving one section creates a new version; other saved sections stay unchanged.</p>
          ) : null}
        </div>
      ) : null}

      {tab === 'history' && !isFirstTime ? (
        <div role="tabpanel" id="panel-history" aria-labelledby="tab-history">
          <ConventionHistoryPanel versions={history} />
        </div>
      ) : null}
    </main>
  );
}
