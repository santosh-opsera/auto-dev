import { adapterRegistry } from './adapterRegistry.js';
import {
  GitHubIntegrationAdapter,
  JiraIntegrationAdapter,
  OpseraStubAdapter,
} from './adapters/launchAdapters.js';

/**
 * Registers launch adapters on the singleton registry.
 * New integrations only need an adapter class + a register() call here —
 * core registry/API code does not change (AC: register without core changes).
 */
export function registerDefaultAdapters(): void {
  if (!adapterRegistry.has('jira')) {
    adapterRegistry.register(new JiraIntegrationAdapter());
  }
  if (!adapterRegistry.has('github')) {
    adapterRegistry.register(new GitHubIntegrationAdapter());
  }
  if (!adapterRegistry.has('opsera')) {
    adapterRegistry.register(new OpseraStubAdapter());
  }
}

export async function bootstrapIntegrationAdapters(): Promise<void> {
  registerDefaultAdapters();
  await adapterRegistry.initializeAll();
  if (!adapterRegistry.isHealthCheckRunning()) {
    adapterRegistry.startPeriodicHealthChecks();
  }
}
