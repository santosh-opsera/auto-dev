import { useEffect, useRef } from 'react';
import type { AuthUser, SessionMetadata } from '../api/auth';

interface ProfileDetailsModalProps {
  open: boolean;
  onClose: () => void;
  user: AuthUser | null;
  session: SessionMetadata | null;
}

function formatProviders(providers: AuthUser['connectedProviders']): string {
  if (providers.length === 0) {
    return 'None';
  }
  return providers.join(', ');
}

/**
 * In-place profile details view (STL-1). Uses the native <dialog> modal
 * pattern established by SessionWarningModal so Escape-to-close and focus
 * trapping come for free. Renders only the fields the /me response exposes.
 */
export function ProfileDetailsModal({ open, onClose, user, session }: ProfileDetailsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
      closeButtonRef.current?.focus();
    }

    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <dialog
      ref={dialogRef}
      className="profile-details-modal"
      aria-labelledby="profile-details-title"
      onClose={onClose}
      onCancel={onClose}
    >
      <div className="profile-details-header">
        <h2 id="profile-details-title">Profile</h2>
        <button
          ref={closeButtonRef}
          type="button"
          className="profile-details-close"
          aria-label="Close profile details"
          onClick={onClose}
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      {user ? (
        <dl className="profile-details-list">
          <div>
            <dt>Name</dt>
            <dd>{user.displayName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Connected providers</dt>
            <dd>{formatProviders(user.connectedProviders)}</dd>
          </div>
          {user.integrations ? (
            <>
              <div>
                <dt>Jira integration</dt>
                <dd>{user.integrations.jira ? 'Connected' : 'Not connected'}</dd>
              </div>
              <div>
                <dt>GitHub repositories</dt>
                <dd>{user.integrations.githubRepos ? 'Connected' : 'Not connected'}</dd>
              </div>
              {user.integrations.atlassianEmail ? (
                <div>
                  <dt>Atlassian email</dt>
                  <dd>{user.integrations.atlassianEmail}</dd>
                </div>
              ) : null}
            </>
          ) : null}
          {session ? (
            <div>
              <dt>Session remaining</dt>
              <dd>{Math.max(0, Math.round(session.remainingMs / 60_000))} minutes</dd>
            </div>
          ) : null}
        </dl>
      ) : (
        <p className="profile-details-empty">Profile details are unavailable right now.</p>
      )}
    </dialog>
  );
}
