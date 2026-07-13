import {
  sampleGitHubAdapterInfo,
  sampleJiraAdapterInfo,
  sampleOpseraAdapterInfo,
} from '@autodev/shared-types';
import { MockIntegrationAdapter } from '../services/integrations/adapters/mockAdapter.js';

export {
  sampleGitHubAdapterInfo,
  sampleJiraAdapterInfo,
  sampleOpseraAdapterInfo,
};

/** Factory helpers for mock adapters used in registry tests. */
export function createHealthyMockAdapter(name: string, capabilities: string[] = ['mock']) {
  return new MockIntegrationAdapter({ name, capabilities, initialStatus: 'inactive' });
}

export function createFailingInitMockAdapter(name: string) {
  return new MockIntegrationAdapter({
    name,
    initialStatus: 'inactive',
    initializeError: new Error(`${name} init boom`),
  });
}

export function createFailingHealthMockAdapter(name: string) {
  return new MockIntegrationAdapter({
    name,
    initialStatus: 'inactive',
    healthCheckError: new Error(`${name} health boom`),
  });
}

export function createUnhealthyMockAdapter(name: string) {
  return new MockIntegrationAdapter({
    name,
    initialStatus: 'inactive',
    healthResult: { healthy: false, message: `${name} unhealthy` },
  });
}
