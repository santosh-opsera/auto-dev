import { create } from 'zustand';
import type { AuthUser, SessionMetadata } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  session: SessionMetadata | null;
  isAuthenticated: boolean;
  showSessionWarning: boolean;
  setAuth: (user: AuthUser, session: SessionMetadata) => void;
  updateSession: (session: SessionMetadata) => void;
  setShowSessionWarning: (show: boolean) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  showSessionWarning: false,
  setAuth: (user, session) =>
    set({
      user,
      session,
      isAuthenticated: true,
      showSessionWarning: Boolean(session.warning),
    }),
  updateSession: (session) =>
    set((state) => ({
      session,
      showSessionWarning: Boolean(session.warning),
      isAuthenticated: state.user !== null,
    })),
  setShowSessionWarning: (show) => set({ showSessionWarning: show }),
  clearAuth: () =>
    set({
      user: null,
      session: null,
      isAuthenticated: false,
      showSessionWarning: false,
    }),
}));

export const SESSION_WARNING_MS = 5 * 60 * 1000;
export const HEARTBEAT_INTERVAL_MS = 60 * 1000;

export function shouldShowSessionWarning(session: SessionMetadata | null): boolean {
  if (!session) {
    return false;
  }

  return Boolean(session.warning) || session.remainingMs <= SESSION_WARNING_MS;
}
