import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { SessionWarningModal } from '../components/SessionWarningModal';
import { PrdApprovedBadge } from '../components/prd/PrdApprovedBadge';
import { PrdRejectForm } from '../components/prd/PrdRejectForm';
import { PrdSectionPanels } from '../components/prd/PrdSectionPanels';
import { PrdVersionHistory } from '../components/prd/PrdVersionHistory';
import { usePrdReview } from '../hooks/usePrdReview';
import { useSessionHeartbeat } from '../hooks/useSessionHeartbeat';
import { useLocaleStore } from '../store/localeStore';
import { formatDate } from '../utils/localeFormat';

interface PrdReviewPageProps {
  onLogoutComplete: () => void;
  mode: 'byId' | 'byTicket';
}

export function PrdReviewPage({ onLogoutComplete, mode }: PrdReviewPageProps) {
  const navigate = useNavigate();
  const { id, ticketKey } = useParams<{ id?: string; ticketKey?: string }>();
  const [showRejectForm, setShowRejectForm] = useState(false);
  const locale = useLocaleStore((state) => state.locale);

  const review = usePrdReview(
    mode === 'byId' ? { prdId: id } : { ticketKey },
  );

  useSessionHeartbeat(true);

  const statusLabel = review.prd?.status.replace('_', ' ') ?? 'unknown';

  return (
    <main className="prd-review-page">
      <SessionWarningModal onLogoutComplete={onLogoutComplete} />

      <header className="dashboard-header">
        <div>
          <h1>PRD review</h1>
          <p>Review, edit, approve, or reject the generated product requirements document.</p>
        </div>
        <nav aria-label="PRD page navigation">
          <Link to="/dashboard" className="text-link">
            Back to dashboard
          </Link>
          {' · '}
          <Link to="/tickets" className="text-link">
            Ticket ingestion
          </Link>
        </nav>
      </header>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {review.liveMessage}
      </div>

      {review.phase === 'loading' || review.phase === 'idle' ? (
        <section className="profile-card" role="status" aria-live="polite">
          <p>Loading PRD…</p>
        </section>
      ) : null}

      {review.phase === 'error' && review.error ? (
        <section className="profile-card ticket-error-state" role="alert">
          <h2>Unable to load PRD</h2>
          <p>{review.error}</p>
          <button type="button" className="secondary-button" onClick={() => review.refresh()}>
            Retry
          </button>
        </section>
      ) : null}

      {review.phase === 'ready' && review.prd ? (
        <>
          <section className="profile-card prd-meta" aria-labelledby="prd-meta-heading">
            <h2 id="prd-meta-heading" className="visually-hidden">
              PRD metadata
            </h2>
            <dl>
              <div>
                <dt>Ticket</dt>
                <dd>{review.prd.ticketKey}</dd>
              </div>
              <div>
                <dt>Version</dt>
                <dd>{review.prd.version}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>
                  <span className={`prd-status-pill prd-status-pill--${review.prd.status}`}>
                    {statusLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt>Updated</dt>
                <dd>
                  <time dateTime={review.prd.updatedAt}>
                    {formatDate(review.prd.updatedAt, locale)}
                  </time>
                </dd>
              </div>
            </dl>

            {review.prd.status === 'approved' &&
            review.prd.approvedBy &&
            review.prd.approvedAt ? (
              <PrdApprovedBadge
                approvedBy={review.prd.approvedBy}
                approvedAt={review.prd.approvedAt}
              />
            ) : null}

            {review.prd.status === 'rejected' && review.prd.rejectionReason ? (
              <div className="prd-rejected-banner" role="status">
                <span className="prd-status-pill prd-status-pill--rejected">Rejected</span>
                <p>
                  Marked for regeneration
                  {review.prd.rejectedBy ? ` by ${review.prd.rejectedBy}` : ''}.
                </p>
                <p>
                  <strong>Reason:</strong> {review.prd.rejectionReason}
                </p>
              </div>
            ) : null}
          </section>

          {review.error ? (
            <section className="profile-card ticket-error-state" role="alert">
              <p>{review.error}</p>
            </section>
          ) : null}

          <div className="prd-tabs" role="tablist" aria-label="PRD review views">
            <button
              type="button"
              role="tab"
              id="prd-tab-content"
              aria-selected={review.activeTab === 'content'}
              aria-controls="prd-panel-content"
              className={
                review.activeTab === 'content'
                  ? 'secondary-button prd-tab is-active'
                  : 'secondary-button prd-tab'
              }
              onClick={() => review.setActiveTab('content')}
            >
              Content
            </button>
            <button
              type="button"
              role="tab"
              id="prd-tab-history"
              aria-selected={review.activeTab === 'history'}
              aria-controls="prd-panel-history"
              className={
                review.activeTab === 'history'
                  ? 'secondary-button prd-tab is-active'
                  : 'secondary-button prd-tab'
              }
              onClick={() => review.setActiveTab('history')}
            >
              Version history
            </button>
          </div>

          {review.activeTab === 'content' ? (
            <div
              id="prd-panel-content"
              role="tabpanel"
              aria-labelledby="prd-tab-content"
              className="prd-content-panel"
            >
              <PrdSectionPanels
                sections={review.prd.sections}
                isEditing={review.isEditing}
                draftSections={review.draftSections}
                onChange={review.updateDraftSection}
              />

              <section className="profile-card prd-actions" aria-labelledby="prd-actions-heading">
                <h2 id="prd-actions-heading">Actions</h2>
                <div className="prd-action-row">
                  {!review.isEditing ? (
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={!review.canEdit}
                      aria-disabled={!review.canEdit}
                      onClick={review.startEditing}
                    >
                      Edit sections
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        disabled={review.isSaving}
                        onClick={() => void review.saveVersion()}
                      >
                        {review.isSaving ? 'Saving…' : 'Save new version'}
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        disabled={review.isSaving}
                        onClick={review.cancelEditing}
                      >
                        Cancel edit
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="primary-button"
                    disabled={!review.canApprove || review.isApproving || review.isEditing}
                    aria-disabled={!review.canApprove || review.isApproving || review.isEditing}
                    onClick={() => void review.approve()}
                  >
                    {review.isApproving ? 'Approving…' : 'Approve PRD'}
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    disabled={!review.canReject || review.isRejecting || review.isEditing}
                    aria-disabled={!review.canReject || review.isRejecting || review.isEditing}
                    onClick={() => setShowRejectForm(true)}
                  >
                    Reject PRD
                  </button>
                </div>

                {showRejectForm && review.canReject ? (
                  <PrdRejectForm
                    isRejecting={review.isRejecting}
                    onReject={async (reason) => {
                      const ok = await review.reject(reason);
                      if (ok) {
                        setShowRejectForm(false);
                      }
                      return ok;
                    }}
                    onCancel={() => setShowRejectForm(false)}
                  />
                ) : null}
              </section>
            </div>
          ) : (
            <div
              id="prd-panel-history"
              role="tabpanel"
              aria-labelledby="prd-tab-history"
              className="prd-history-panel"
            >
              <PrdVersionHistory
                history={review.history}
                compareFromId={review.compareFromId}
                compareToId={review.compareToId}
                onCompareChange={review.setCompareSelection}
                activePrdId={review.prd.id}
                onSelectVersion={(prdId) => {
                  navigate(`/prd/${encodeURIComponent(prdId)}`);
                }}
              />
            </div>
          )}
        </>
      ) : null}
    </main>
  );
}
