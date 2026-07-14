import type {
  AdapterHealthResult,
  IntegrationAdapterInfo,
  IntegrationProviderStatus,
  IntegrationsListResponse,
  IntegrationsStatusResponse,
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

const STATUS_CHECKED_AT = '2026-07-14T12:00:00.000Z';

export const sampleGitHubStatusHealthy: IntegrationProviderStatus = {
  name: 'github',
  connected: true,
  tokenValid: true,
  connectionState: 'connected',
  lastCheckedAt: STATUS_CHECKED_AT,
  tokenExpiresAt: '2026-08-01T00:00:00.000Z',
};

export const sampleJiraStatusHealthy: IntegrationProviderStatus = {
  name: 'jira',
  connected: true,
  tokenValid: true,
  connectionState: 'connected',
  lastCheckedAt: STATUS_CHECKED_AT,
  tokenExpiresAt: '2026-07-14T13:00:00.000Z',
};

/** All integrations healthy — IntegrationBanner should not render. */
export const sampleIntegrationsStatusAllHealthy: IntegrationsStatusResponse = {
  github: sampleGitHubStatusHealthy,
  jira: sampleJiraStatusHealthy,
  checkedAt: STATUS_CHECKED_AT,
};

/** GitHub missing access token / repo scopes. */
export const sampleIntegrationsStatusGitHubDisconnected: IntegrationsStatusResponse = {
  github: {
    name: 'github',
    connected: false,
    tokenValid: false,
    connectionState: 'disconnected',
    lastCheckedAt: STATUS_CHECKED_AT,
    message: 'GitHub not connected',
  },
  jira: sampleJiraStatusHealthy,
  checkedAt: STATUS_CHECKED_AT,
};

/** Jira access token past expiry. */
export const sampleIntegrationsStatusJiraExpired: IntegrationsStatusResponse = {
  github: sampleGitHubStatusHealthy,
  jira: {
    name: 'jira',
    connected: true,
    tokenValid: false,
    connectionState: 'expired',
    lastCheckedAt: STATUS_CHECKED_AT,
    tokenExpiresAt: '2026-07-14T10:00:00.000Z',
    message: 'Jira connection expired — Reconnect',
  },
  checkedAt: STATUS_CHECKED_AT,
};

/** Capability lists used by thin launch adapters. */
export const jiraAdapterCapabilities = sampleJiraAdapterInfo.capabilities;
export const githubAdapterCapabilities = sampleGitHubAdapterInfo.capabilities;
export const opseraAdapterCapabilities = sampleOpseraAdapterInfo.capabilities;
