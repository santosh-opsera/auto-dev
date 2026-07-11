import type { ReactNode } from 'react';
import { TemplateVariableHints } from './TemplateVariableHints';

interface ConventionFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  multiline?: boolean;
  variables?: string[];
  preview?: ReactNode;
}

export function ConventionField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  multiline = false,
  variables,
  preview,
}: ConventionFieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');

  const commonProps = {
    id,
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(event.target.value),
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    className: error ? 'field-input field-input-error' : 'field-input',
  };

  return (
    <div className="convention-field">
      <label htmlFor={id}>{label}</label>
      {hint ? (
        <p id={`${id}-hint`} className="field-hint">
          {hint}
        </p>
      ) : null}
      {multiline ? (
        <textarea {...commonProps} rows={4} />
      ) : (
        <input {...commonProps} type="text" />
      )}
      {variables ? (
        <TemplateVariableHints
          fieldId={id}
          variables={variables}
          currentValue={value}
          onInsert={onChange}
        />
      ) : null}
      {preview ? <div className="field-preview">{preview}</div> : null}
      {error ? (
        <p id={`${id}-error`} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
