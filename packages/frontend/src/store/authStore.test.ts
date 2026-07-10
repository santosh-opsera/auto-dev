import { beforeEach, describe, expect, it } from 'vitest';
import {
  mockAuthUser,
  mockSessionMetadata,
  mockWarningSessionMetadata,
} from '../fixtures/auth';
import {
  HEARTBEAT_INTERVAL_MS,
  SESSION_WARNING_MS,
  shouldShowSessionWarning,
  useAuthStore,
} from './authStore';

describe('authStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      user: null,
      session: null,
      isAuthenticated: false,
      showSessionWarning: false,
    });
  });

  it('sets authenticated state when auth is established', () => {
    useAuthStore.getState().setAuth(mockAuthUser, mockSessionMetadata);

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('alex.dev@example.com');
    expect(state.session?.remainingMs).toBe(mockSessionMetadata.remainingMs);
  });

  it('shows session warning when remaining time is below threshold', () => {
    useAuthStore.getState().setAuth(mockAuthUser, mockWarningSessionMetadata);

    expect(useAuthStore.getState().showSessionWarning).toBe(true);
    expect(shouldShowSessionWarning(mockWarningSessionMetadata)).toBe(true);
  });

  it('clears auth state on logout', () => {
    useAuthStore.getState().setAuth(mockAuthUser, mockSessionMetadata);
    useAuthStore.getState().clearAuth();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.showSessionWarning).toBe(false);
  });
});

describe('heartbeat constants', () => {
  it('uses a 60 second polling interval', () => {
    expect(HEARTBEAT_INTERVAL_MS).toBe(60_000);
  });

  it('warns five minutes before expiry', () => {
    expect(SESSION_WARNING_MS).toBe(5 * 60 * 1000);
  });
});

describe('draft auto-save behavior', () => {
  it('persists draft data to localStorage before session timeout redirect', async () => {
    const { saveDraftToLocalStorage, readDraftFromLocalStorage, clearDraftFromLocalStorage } =
      await import('../utils/draftStorage');

    clearDraftFromLocalStorage();
    const snapshot = saveDraftToLocalStorage('Draft saved before redirect');

    expect(snapshot.note).toBe('Draft saved before redirect');
    expect(readDraftFromLocalStorage()?.savedAt).toBe(snapshot.savedAt);
  });
});
