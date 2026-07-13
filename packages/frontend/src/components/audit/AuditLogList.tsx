import type { AuditLogRecord } from '@autodev/shared-types';
import { useLocaleStore } from '../../store/localeStore';
import { formatDate } from '../../utils/localeFormat';

interface AuditLogListProps {
  records: AuditLogRecord[];
}

export function AuditLogList({ records }: AuditLogListProps) {
  const locale = useLocaleStore((state) => state.locale);

  if (records.length === 0) {
    return (
      <p className="field-hint" role="status">
        No audit log entries yet.
      </p>
    );
  }

  return (
    <section className="audit-log-list" aria-labelledby="audit-log-heading">
      <h2 id="audit-log-heading">Audit log</h2>
      <ol className="audit-log-entries">
        {records.map((entry) => (
          <li key={entry.id} className="audit-log-entry">
            <p className="audit-log-meta">
              <time dateTime={entry.timestamp}>{formatDate(entry.timestamp, locale)}</time>
              {' · '}
              <span>{entry.operation}</span>
              {' · '}
              <span>{entry.resource}</span>
            </p>
            <p className="audit-log-actor">
              Actor: <strong>{entry.actor}</strong>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
