import { useRef } from 'react';
import { insertTemplateVariable } from '../../utils/templateVariables';

interface TemplateVariableHintsProps {
  variables: string[];
  onInsert: (nextValue: string) => void;
  currentValue: string;
  fieldId: string;
}

export function TemplateVariableHints({
  variables,
  onInsert,
  currentValue,
  fieldId,
}: TemplateVariableHintsProps) {
  const selectionRef = useRef<{ start: number; end: number }>({ start: currentValue.length, end: currentValue.length });

  return (
    <div className="template-variable-hints" role="group" aria-label="Template variables">
      <p className="field-hint">Click to insert a variable:</p>
      <div className="template-variable-list">
        {variables.map((variable) => (
          <button
            key={variable}
            type="button"
            className="template-variable-chip"
            aria-label={`Insert ${variable} into ${fieldId}`}
            onMouseDown={(event) => {
              event.preventDefault();
              const input = document.getElementById(fieldId) as HTMLInputElement | HTMLTextAreaElement | null;
              if (input) {
                selectionRef.current = {
                  start: input.selectionStart ?? currentValue.length,
                  end: input.selectionEnd ?? currentValue.length,
                };
              }
            }}
            onClick={() => {
              const { start, end } = selectionRef.current;
              onInsert(insertTemplateVariable(currentValue, variable, start, end));
            }}
          >
            {'{'}{variable}{'}'}
          </button>
        ))}
      </div>
    </div>
  );
}
