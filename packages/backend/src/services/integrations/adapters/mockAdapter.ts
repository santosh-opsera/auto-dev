import type { AdapterStatus } from '@autodev/shared-types';
import type { AdapterHealthCheckResult, IntegrationAdapter } from '../types.js';

export interface MockAdapterOptions {
  name: string;
  capabilities?: string[];
  initialStatus?: AdapterStatus;
  message?: string;
  skipLifecycle?: boolean;
  initializeError?: Error;
  healthCheckError?: Error;
  healthResult?: AdapterHealthCheckResult;
}

/**
 * Configurable mock adapter for registry unit/integration tests.
 * Tracks call counts so lifecycle and failure-isolation scenarios are assertable.
 */
export class MockIntegrationAdapter implements IntegrationAdapter {
  readonly name: string;
  readonly initialStatus?: AdapterStatus;
  readonly message?: string;
  readonly skipLifecycle?: boolean;

  initializeCalls = 0;
  healthCheckCalls = 0;

  private readonly capabilities: string[];
  private readonly initializeError?: Error;
  private readonly healthCheckError?: Error;
  private healthResult: AdapterHealthCheckResult;

  constructor(options: MockAdapterOptions) {
    this.name = options.name;
    this.capabilities = options.capabilities ?? ['mock'];
    this.initialStatus = options.initialStatus;
    this.message = options.message;
    this.skipLifecycle = options.skipLifecycle;
    this.initializeError = options.initializeError;
    this.healthCheckError = options.healthCheckError;
    this.healthResult = options.healthResult ?? { healthy: true, message: 'mock ok' };
  }

  async initialize(): Promise<void> {
    this.initializeCalls += 1;
    if (this.initializeError) {
      throw this.initializeError;
    }
  }

  async healthCheck(): Promise<AdapterHealthCheckResult> {
    this.healthCheckCalls += 1;
    if (this.healthCheckError) {
      throw this.healthCheckError;
    }
    return this.healthResult;
  }

  getCapabilities(): string[] {
    return [...this.capabilities];
  }

  setHealthResult(result: AdapterHealthCheckResult): void {
    this.healthResult = result;
  }
}
