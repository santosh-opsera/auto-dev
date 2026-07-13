import type { WorkflowListResponse, WorkflowResponse } from '@autodev/shared-types';
import { apiFetch } from './client';

export async function fetchWorkflows(state?: string): Promise<WorkflowListResponse> {
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  return apiFetch<WorkflowListResponse>(`/api/v1/workflows${query}`);
}

export async function fetchWorkflow(id: string): Promise<WorkflowResponse> {
  return apiFetch<WorkflowResponse>(`/api/v1/workflows/${encodeURIComponent(id)}`);
}

export async function pauseWorkflow(id: string): Promise<WorkflowResponse> {
  return apiFetch<WorkflowResponse>(`/api/v1/workflows/${encodeURIComponent(id)}/pause`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function resumeWorkflow(id: string): Promise<WorkflowResponse> {
  return apiFetch<WorkflowResponse>(`/api/v1/workflows/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function cancelWorkflow(id: string): Promise<WorkflowResponse> {
  return apiFetch<WorkflowResponse>(`/api/v1/workflows/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
