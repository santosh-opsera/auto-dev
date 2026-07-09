export const DRAFT_STORAGE_KEY = 'autodev_draft';

export interface DraftSnapshot {
  savedAt: string;
  note: string;
}

export function saveDraftToLocalStorage(note = 'Session expired — draft auto-saved'): DraftSnapshot {
  const snapshot: DraftSnapshot = {
    savedAt: new Date().toISOString(),
    note,
  };
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(snapshot));
  return snapshot;
}

export function readDraftFromLocalStorage(): DraftSnapshot | null {
  const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as DraftSnapshot;
  } catch {
    return null;
  }
}

export function clearDraftFromLocalStorage(): void {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}
