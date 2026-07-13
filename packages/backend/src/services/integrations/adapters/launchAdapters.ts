import {
  githubAdapterCapabilities,
  jiraAdapterCapabilities,
  opseraAdapterCapabilities,
} from '@autodev/shared-types';
import type { AdapterHealthCheckResult, IntegrationAdapter } from '../types.js';

/** Thin Jira integration adapter wrapping existing ticket/Forge services. */
export class JiraIntegrationAdapter implements IntegrationAdapter {
  readonly name = 'jira';
  readonly initialStatus = 'inactive' as const;

  async initialize(): Promise<void> {
    // Existing Jira services are request-scoped; registry only tracks lifecycle.
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    return { healthy: true, message: 'Jira adapter ready' };
  }

  getCapabilities(): string[] {
    return [...jiraAdapterCapabilities];
  }
}

/** Thin GitHub integration adapter wrapping existing GitHub API clients. */
export class GitHubIntegrationAdapter implements IntegrationAdapter {
  readonly name = 'github';
  readonly initialStatus = 'inactive' as const;

  async initialize(): Promise<void> {
    // Existing GitHub services are request-scoped; registry only tracks lifecycle.
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    return { healthy: true, message: 'GitHub adapter ready' };
  }

  getCapabilities(): string[] {
    return [...githubAdapterCapabilities];
  }
}

/**
 * Opsera CI/CD stub — registered inactive with "coming soon" capabilities.
 * Real implementation is post-launch (out of scope for WO-035).
 */
export class OpseraStubAdapter implements IntegrationAdapter {
  readonly name = 'opsera';
  readonly initialStatus = 'inactive' as const;
  readonly skipLifecycle = true;
  readonly message = 'coming soon';

  async initialize(): Promise<void> {
    // Stub stays inactive; no-op.
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    return { healthy: false, message: 'coming soon' };
  }

  getCapabilities(): string[] {
    return [...opseraAdapterCapabilities];
  }
}
