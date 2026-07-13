import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { sampleAuditLogRecords } from '../../fixtures/audit';
import { SAMPLE_ISO_TIMESTAMP } from '../../fixtures/localeFormat';
import { useLocaleStore } from '../../store/localeStore';
import { FALLBACK_LOCALE, formatDate } from '../../utils/localeFormat';
import { AuditLogList } from './AuditLogList';

afterEach(() => {
  cleanup();
});

describe('AuditLogList', () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: FALLBACK_LOCALE });
  });

  it('renders locale-aware timestamps for audit entries', () => {
    useLocaleStore.getState().setLocale('en-US');
    render(<AuditLogList records={sampleAuditLogRecords} />);

    expect(screen.getByRole('heading', { name: 'Audit log' })).toBeInTheDocument();
    expect(screen.getByText(formatDate(SAMPLE_ISO_TIMESTAMP, 'en-US'))).toBeInTheDocument();
    expect(screen.getByText(/user-001/)).toBeInTheDocument();
    expect(screen.getByText(/login_failed/)).toBeInTheDocument();
  });

  it('formats timestamps with de-DE locale from app state', () => {
    useLocaleStore.getState().setLocale('de-DE');
    render(<AuditLogList records={[sampleAuditLogRecords[0]!]} />);

    expect(screen.getByText(formatDate(SAMPLE_ISO_TIMESTAMP, 'de-DE'))).toBeInTheDocument();
  });

  it('shows empty state when there are no records', () => {
    render(<AuditLogList records={[]} />);
    expect(screen.getByRole('status')).toHaveTextContent(/No audit log entries/);
  });
});
