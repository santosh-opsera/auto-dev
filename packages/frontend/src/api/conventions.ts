import type {
  ConventionDefaultsResponse,
  ConventionHistoryResponse,
  ConventionSettingsInput,
  ConventionSettingsListResponse,
  ConventionSettingsResponse,
} from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchConventionDefaults(): Promise<ConventionDefaultsResponse> {
  return apiFetch<ConventionDefaultsResponse>('/api/v1/conventions/defaults');
}

export async function fetchActiveConventionSettings(): Promise<ConventionSettingsListResponse> {
  return apiFetch<ConventionSettingsListResponse>('/api/v1/conventions');
}

export async function fetchConventionHistory(): Promise<ConventionHistoryResponse> {
  return apiFetch<ConventionHistoryResponse>('/api/v1/conventions/history');
}

export async function createConventionSettings(
  input: ConventionSettingsInput,
): Promise<ConventionSettingsResponse> {
  return apiFetch<ConventionSettingsResponse>('/api/v1/conventions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateConventionSettings(
  id: string,
  input: ConventionSettingsInput,
): Promise<ConventionSettingsResponse> {
  return apiFetch<ConventionSettingsResponse>(`/api/v1/conventions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}
