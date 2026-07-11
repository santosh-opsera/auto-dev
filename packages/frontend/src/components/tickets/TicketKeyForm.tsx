import { useState } from 'react';
import { validateTicketKey } from '../../utils/ticketValidation';

interface TicketKeyFormProps {
  onSubmit: (ticketKey: string) => void;
  isSubmitting: boolean;
  initialValue?: string;
}

export function TicketKeyForm({ onSubmit, isSubmitting, initialValue = '' }: TicketKeyFormProps) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    const validationError = validateTicketKey(value);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(undefined);
    onSubmit(value.trim());
  };

  return (
    <form className="ticket-key-form" onSubmit={handleSubmit} aria-label="Search ticket by key">
      <div className="convention-field">
        <label htmlFor="ticket-key">Ticket key</label>
        <p id="ticket-key-hint" className="field-hint">
          Enter a Jira ticket key such as OPL-1234.
        </p>
        <input
          id="ticket-key"
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby="ticket-key-hint"
          className={error ? 'field-input field-input-error' : 'field-input'}
          placeholder="OPL-1234"
          disabled={isSubmitting}
        />
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button type="submit" className="primary-button" disabled={isSubmitting}>
        {isSubmitting ? 'Loading…' : 'Load and parse ticket'}
      </button>
    </form>
  );
}
