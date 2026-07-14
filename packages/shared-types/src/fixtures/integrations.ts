import type {
  AdapterHealthResult,
  IntegrationAdapterInfo,
  IntegrationsListResponse,
} from '../integrations.js';

export const sampleAdapterHealthHealthy: AdapterHealthResult = {
  healthy: true,
  message: 'OK',
  checkedAt: '2026-07-13T12:00:00.000Z',
};

export const sampleAdapterHealthUnhealthy: AdapterHealthResult = {
  healthy: false,
  message: 'Connection refused',
  checkedAt: '2026-07-13T12:00:00.000Z',
};

export const sampleJiraAdapterInfo: IntegrationAdapterInfo = {
  name: 'jira',
  status: 'active',
  capabilities: ['ticket-ingest', 'gap-detection'],
  lastHealthCheck: sampleAdapterHealthHealthy,
};

export const sampleGitHubAdapterInfo: IntegrationAdapterInfo = {
  name: 'github',
  status: 'active',
  capabilities: ['repository-access', 'pull-request', 'branch-commit'],
  lastHealthCheck: sampleAdapterHealthHealthy,
};

export const sampleOpseraAdapterInfo: IntegrationAdapterInfo = {
  name: 'opsera',
  status: 'inactive',
  capabilities: ['coming soon'],
  message: 'coming soon',
};

export const sampleIntegrationsListResponse: IntegrationsListResponse = {
  adapters: [sampleJiraAdapterInfo, sampleGitHubAdapterInfo, sampleOpseraAdapterInfo],
};

/** Capability lists used by thin launch adapters. */
export const jiraAdapterCapabilities = sampleJiraAdapterInfo.capabilities;
export const githubAdapterCapabilities = sampleGitHubAdapterInfo.capabilities;
export const opseraAdapterCapabilities = sampleOpseraAdapterInfo.capabilities;
