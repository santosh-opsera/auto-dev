import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { sendHeartbeat } from '../api/auth';
import {
  HEARTBEAT_INTERVAL_MS,
  shouldShowSessionWarning,
  useAuthStore,
} from '../store/authStore';
import { saveDraftToLocalStorage } from '../utils/draftStorage';

export function useSessionHeartbeat(enabled: boolean): void {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const updateSession = useAuthStore((state) => state.updateSession);
  const setShowSessionWarning = useAuthStore((state) => state.setShowSessionWarning);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    const runHeartbeat = async (): Promise<void> => {
      try {
        const response = await sendHeartbeat();
        updateSession(response.session);
        setShowSessionWarning(shouldShowSessionWarning(response.session));
      } catch {
        saveDraftToLocalStorage();
        clearAuth();
        navigateRef.current('/login', { replace: true });
      }
    };

    void runHeartbeat();
    intervalRef.current = window.setInterval(() => {
      void runHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [clearAuth, enabled, setShowSessionWarning, updateSession]);
}
