import type { IntegrationsStatusResponse } from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchIntegrationsStatus(): Promise<IntegrationsStatusResponse> {
  return apiFetch<IntegrationsStatusResponse>('/api/v1/integrations/status');
}

export { getGitHubReposConnectUrl, getJiraConnectUrl } from './auth';
