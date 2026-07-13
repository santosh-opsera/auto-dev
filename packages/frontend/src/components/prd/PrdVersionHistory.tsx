import {
  PRD_SECTION_LABELS,
  type PrdResponse,
} from '@autodev/shared-types';
import { useLocaleStore } from '../../store/localeStore';
import { formatDate } from '../../utils/localeFormat';
import { diffPrdSections } from '../../utils/prdDiff';

interface PrdVersionHistoryProps {
  history: PrdResponse[];
  compareFromId: string | null;
  compareToId: string | null;
  onCompareChange: (fromId: string | null, toId: string | null) => void;
  onSelectVersion: (prdId: string) => void;
  activePrdId: string | null;
}

export function PrdVersionHistory({
  history,
  compareFromId,
  compareToId,
  onCompareChange,
  onSelectVersion,
  activePrdId,
}: PrdVersionHistoryProps) {
  const locale = useLocaleStore((state) => state.locale);
  const from = history.find((entry) => entry.id === compareFromId) ?? null;
  const to = history.find((entry) => entry.id === compareToId) ?? null;
  const diff = from && to ? diffPrdSections(from.sections, to.sections) : null;

  return (
    <section className="prd-history" aria-labelledby="prd-history-heading">
      <h2 id="prd-history-heading">Version history</h2>

      {history.length === 0 ? (
        <p className="field-hint" role="status">
          No versions available yet.
        </p>
      ) : (
        <ul className="prd-version-list">
          {history.map((entry) => {
            const selected = entry.id === activePrdId;
            return (
              <li key={entry.id} className={selected ? 'prd-version-item is-active' : 'prd-version-item'}>
                <button
                  type="button"
                  className="text-link prd-version-select"
                  onClick={() => onSelectVersion(entry.id)}
                  aria-current={selected ? 'true' : undefined}
                >
                  Version {entry.version}
                </button>
                <span className={`prd-status-pill prd-status-pill--${entry.status}`}>
                  {entry.status.replace('_', ' ')}
                </span>
                <time dateTime={entry.updatedAt}>
                  {formatDate(entry.updatedAt, locale)}
                </time>
              </li>
            );
          })}
        </ul>
      )}

      <div className="prd-diff-controls profile-card">
        <h3 id="prd-diff-heading">Compare versions</h3>
        <div className="prd-diff-selectors" role="group" aria-labelledby="prd-diff-heading">
          <label htmlFor="prd-diff-from">
            From
            <select
              id="prd-diff-from"
              value={compareFromId ?? ''}
              onChange={(event) =>
                onCompareChange(event.target.value || null, compareToId)
              }
            >
              <option value="">Select version</option>
              {history.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  v{entry.version}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="prd-diff-to">
            To
            <select
              id="prd-diff-to"
              value={compareToId ?? ''}
              onChange={(event) =>
                onCompareChange(compareFromId, event.target.value || null)
              }
            >
              <option value="">Select version</option>
              {history.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  v{entry.version}
                </option>
              ))}
            </select>
          </label>
        </div>

        {diff ? (
          <div className="prd-diff-results" aria-live="polite">
            <p role="status">
              {diff.changedSectionCount === 0
                ? 'No section differences between the selected versions.'
                : `${diff.changedSectionCount} section${diff.changedSectionCount === 1 ? '' : 's'} changed.`}
            </p>
            {diff.sections
              .filter((section) => section.changed)
              .map((section) => (
                <article
                  key={section.key}
                  className="prd-diff-section"
                  aria-labelledby={`diff-${section.key}`}
                >
                  <h4 id={`diff-${section.key}`}>{PRD_SECTION_LABELS[section.key]}</h4>
                  <pre className="prd-diff-lines" tabIndex={0}>
                    {section.lines.map((line, index) => (
                      <span
                        key={`${section.key}-${index}-${line.kind}`}
                        className={`prd-diff-line prd-diff-line--${line.kind}`}
                      >
                        {line.kind === 'added' ? '+ ' : line.kind === 'removed' ? '- ' : '  '}
                        {line.text}
                        {'\n'}
                      </span>
                    ))}
                  </pre>
                </article>
              ))}
          </div>
        ) : (
          <p className="field-hint">Select two versions to view a line/section diff.</p>
        )}
      </div>
    </section>
  );
}
