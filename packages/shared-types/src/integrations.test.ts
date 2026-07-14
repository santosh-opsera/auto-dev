import { describe, expect, it } from 'vitest';
import {
  ADAPTER_STATUSES,
  DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS,
  INTEGRATION_ADAPTER_NAMES,
  INTEGRATION_CONNECTION_STATES,
  adapterHealthResultSchema,
  adapterStatusSchema,
  integrationAdapterInfoSchema,
  integrationsListResponseSchema,
  integrationsStatusResponseSchema,
} from './integrations.js';
import {
  sampleAdapterHealthHealthy,
  sampleGitHubAdapterInfo,
  sampleIntegrationsListResponse,
  sampleIntegrationsStatusAllHealthy,
  sampleIntegrationsStatusGitHubDisconnected,
  sampleIntegrationsStatusJiraExpired,
  sampleJiraAdapterInfo,
  sampleOpseraAdapterInfo,
} from './fixtures/integrations.js';

describe('integrations schemas', () => {
  it('exposes adapter statuses and launch adapter names', () => {
    expect(ADAPTER_STATUSES).toEqual(['active', 'inactive', 'error']);
    expect(INTEGRATION_ADAPTER_NAMES).toEqual(['jira', 'github', 'opsera']);
    expect(INTEGRATION_CONNECTION_STATES).toEqual([
      'connected',
      'disconnected',
      'expired',
      'error',
    ]);
    expect(DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS).toBe(5 * 60 * 1000);
  });

  it('parses adapter status and health results', () => {
    expect(adapterStatusSchema.parse('active')).toBe('active');
    expect(adapterHealthResultSchema.parse(sampleAdapterHealthHealthy)).toEqual(
      sampleAdapterHealthHealthy,
    );
  });

  it('parses adapter info and list response fixtures', () => {
    expect(integrationAdapterInfoSchema.parse(sampleJiraAdapterInfo).name).toBe('jira');
    expect(integrationAdapterInfoSchema.parse(sampleGitHubAdapterInfo).status).toBe('active');
    expect(integrationAdapterInfoSchema.parse(sampleOpseraAdapterInfo)).toMatchObject({
      name: 'opsera',
      status: 'inactive',
      capabilities: ['coming soon'],
      message: 'coming soon',
    });
    expect(integrationsListResponseSchema.parse(sampleIntegrationsListResponse).adapters).toHaveLength(
      3,
    );
  });

  it('parses integrations status fixtures (healthy, github disconnected, jira expired)', () => {
    expect(integrationsStatusResponseSchema.parse(sampleIntegrationsStatusAllHealthy)).toMatchObject({
      github: { connectionState: 'connected', tokenValid: true },
      jira: { connectionState: 'connected', tokenValid: true },
    });
    expect(
      integrationsStatusResponseSchema.parse(sampleIntegrationsStatusGitHubDisconnected).github,
    ).toMatchObject({
      connected: false,
      connectionState: 'disconnected',
      message: 'GitHub not connected',
    });
    expect(
      integrationsStatusResponseSchema.parse(sampleIntegrationsStatusJiraExpired).jira,
    ).toMatchObject({
      connectionState: 'expired',
      tokenValid: false,
      message: 'Jira connection expired — Reconnect',
    });
  });
});
