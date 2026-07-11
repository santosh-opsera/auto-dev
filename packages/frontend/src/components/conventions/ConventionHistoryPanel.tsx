import type { ConventionSettingsResponse } from '@autodev/shared-types';
import { getChangedConventionFields } from '../../utils/templateVariables';

interface ConventionHistoryPanelProps {
  versions: ConventionSettingsResponse[];
}

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function ConventionHistoryPanel({ versions }: ConventionHistoryPanelProps) {
  if (versions.length === 0) {
    return <p>No convention versions saved yet.</p>;
  }

  return (
    <section aria-labelledby="history-heading" className="convention-history">
      <h2 id="history-heading">Version history</h2>
      <ul className="history-list">
        {versions.map((version, index) => {
          const previous = versions[index + 1];
          const changedFields = previous
            ? getChangedConventionFields(
                {
                  commitMessageFormat: version.commitMessageFormat,
                  branchNamingPattern: version.branchNamingPattern,
                  prTitleTemplate: version.prTitleTemplate,
                  prDescriptionTemplate: version.prDescriptionTemplate,
                  reviewerAssignmentRules: version.reviewerAssignmentRules,
                },
                {
                  commitMessageFormat: previous.commitMessageFormat,
                  branchNamingPattern: previous.branchNamingPattern,
                  prTitleTemplate: previous.prTitleTemplate,
                  prDescriptionTemplate: previous.prDescriptionTemplate,
                  reviewerAssignmentRules: previous.reviewerAssignmentRules,
                },
              )
            : ['commitMessageFormat', 'branchNamingPattern', 'prTitleTemplate', 'prDescriptionTemplate', 'reviewerAssignmentRules'];

          return (
            <li key={version.id} className="history-item">
              <header>
                <strong>Version {version.version}</strong>
                {version.isActive ? <span className="history-badge">Active</span> : null}
                <time dateTime={version.createdAt}>{formatTimestamp(version.createdAt)}</time>
              </header>
              <dl>
                {(
                  [
                    'commitMessageFormat',
                    'branchNamingPattern',
                    'prTitleTemplate',
                    'prDescriptionTemplate',
                    'reviewerAssignmentRules',
                  ] as const
                ).map((field) => (
                  <div
                    key={field}
                    className={changedFields.includes(field) ? 'history-field changed' : 'history-field'}
                  >
                    <dt>{field}</dt>
                    <dd>
                      {field === 'reviewerAssignmentRules'
                        ? JSON.stringify(version.reviewerAssignmentRules)
                        : String(version[field])}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
