import { useCallback, useEffect, useState } from 'react';
import type { ConventionSettingsInput, ConventionSettingsResponse } from '@autodev/shared-types';
import {
  createConventionSettings,
  fetchActiveConventionSettings,
  fetchConventionDefaults,
  fetchConventionHistory,
  updateConventionSettings,
} from '../api/conventions';
import { mockConventionInput } from '../fixtures/conventions';

export function useConventionSettings() {
  const [active, setActive] = useState<ConventionSettingsResponse | null>(null);
  const [defaults, setDefaults] = useState<{ templates: ConventionSettingsInput; availableVariables: string[] } | null>(
    null,
  );
  const [history, setHistory] = useState<ConventionSettingsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [activeResponse, defaultsResponse, historyResponse] = await Promise.all([
        fetchActiveConventionSettings(),
        fetchConventionDefaults(),
        fetchConventionHistory(),
      ]);
      setActive(activeResponse.settings);
      setDefaults(defaultsResponse);
      setHistory(historyResponse.versions);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load convention settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async (input: ConventionSettingsInput): Promise<ConventionSettingsResponse> => {
    if (active) {
      const updated = await updateConventionSettings(active.id, input);
      await reload();
      return updated;
    }

    const created = await createConventionSettings(input);
    await reload();
    return created;
  };

  const initialForm = active ?? defaults?.templates ?? mockConventionInput;

  return {
    active,
    defaults,
    history,
    loading,
    error,
    reload,
    save,
    initialForm,
    isFirstTime: !active,
  };
}
