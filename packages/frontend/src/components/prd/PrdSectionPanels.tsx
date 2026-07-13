import {
  PRD_SECTION_KEYS,
  PRD_SECTION_LABELS,
  formatPrdSectionValue,
  type PrdSectionKey,
  type PrdSections,
} from '@autodev/shared-types';

interface PrdSectionPanelsProps {
  sections: PrdSections;
  isEditing: boolean;
  draftSections: PrdSections | null;
  onChange: (key: PrdSectionKey, value: string | string[]) => void;
}

function isListSection(key: PrdSectionKey): boolean {
  return key !== 'problemStatement' && key !== 'solutionOutline';
}

export function PrdSectionPanels({
  sections,
  isEditing,
  draftSections,
  onChange,
}: PrdSectionPanelsProps) {
  const source = isEditing && draftSections ? draftSections : sections;

  return (
    <div className="prd-sections">
      {PRD_SECTION_KEYS.map((key) => {
        const label = PRD_SECTION_LABELS[key];
        const value = source[key];
        const fieldId = `prd-section-${key}`;
        const textValue = formatPrdSectionValue(value);

        return (
          <section
            key={key}
            className="profile-card prd-section-panel"
            aria-labelledby={`${fieldId}-heading`}
          >
            <h3 id={`${fieldId}-heading`}>{label}</h3>
            {isEditing ? (
              <div className="prd-section-edit">
                <label className="visually-hidden" htmlFor={fieldId}>
                  Edit {label}
                </label>
                <textarea
                  id={fieldId}
                  className="prd-section-textarea"
                  rows={isListSection(key) ? Math.max(4, textValue.split('\n').length + 1) : 5}
                  value={textValue}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (isListSection(key)) {
                      onChange(key, next.split('\n'));
                    } else {
                      onChange(key, next);
                    }
                  }}
                  aria-describedby={
                    isListSection(key) ? `${fieldId}-hint` : undefined
                  }
                />
                {isListSection(key) ? (
                  <p id={`${fieldId}-hint`} className="field-hint">
                    One item per line.
                  </p>
                ) : null}
              </div>
            ) : (
              <pre className="prd-section-content" tabIndex={0}>
                {textValue}
              </pre>
            )}
          </section>
        );
      })}
    </div>
  );
}
