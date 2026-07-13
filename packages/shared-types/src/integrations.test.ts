import { describe, expect, it } from 'vitest';
import {
  ADAPTER_STATUSES,
  DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS,
  INTEGRATION_ADAPTER_NAMES,
  adapterHealthResultSchema,
  adapterStatusSchema,
  integrationAdapterInfoSchema,
  integrationsListResponseSchema,
} from './integrations.js';
import {
  sampleAdapterHealthHealthy,
  sampleGitHubAdapterInfo,
  sampleIntegrationsListResponse,
  sampleJiraAdapterInfo,
  sampleOpseraAdapterInfo,
} from './fixtures/integrations.js';

describe('integrations schemas', () => {
  it('exposes adapter statuses and launch adapter names', () => {
    expect(ADAPTER_STATUSES).toEqual(['active', 'inactive', 'error']);
    expect(INTEGRATION_ADAPTER_NAMES).toEqual(['jira', 'github', 'opsera']);
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
});
