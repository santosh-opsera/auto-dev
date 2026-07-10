import { useEffect, useRef } from 'react';
import { logout, sendHeartbeat } from '../api/auth';
import { useAuthStore } from '../store/authStore';

interface SessionWarningModalProps {
  onLogoutComplete: () => void;
}

export function SessionWarningModal({ onLogoutComplete }: SessionWarningModalProps) {
  const showSessionWarning = useAuthStore((state) => state.showSessionWarning);
  const setShowSessionWarning = useAuthStore((state) => state.setShowSessionWarning);
  const updateSession = useAuthStore((state) => state.updateSession);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const extendButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (showSessionWarning && !dialog.open) {
      dialog.showModal();
      extendButtonRef.current?.focus();
    }

    if (!showSessionWarning && dialog.open) {
      dialog.close();
    }
  }, [showSessionWarning]);

  if (!showSessionWarning) {
    return null;
  }

  const handleExtend = async (): Promise<void> => {
    const response = await sendHeartbeat();
    updateSession(response.session);
    setShowSessionWarning(false);
  };

  const handleLogout = async (): Promise<void> => {
    try {
      await logout();
    } finally {
      clearAuth();
      onLogoutComplete();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="session-warning-title"
      aria-describedby="session-warning-description"
      className="session-warning-modal"
    >
      <h2 id="session-warning-title">Session expiring soon</h2>
      <p id="session-warning-description">
        Your session will expire in less than 5 minutes. Extend your session or log out now.
      </p>
      <div className="session-warning-actions">
        <button ref={extendButtonRef} type="button" onClick={() => void handleExtend()}>
          Extend session
        </button>
        <button type="button" onClick={() => void handleLogout()}>
          Log out
        </button>
      </div>
    </dialog>
  );
}
