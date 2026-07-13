import {
  DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS,
  type AdapterHealthResult,
  type AdapterStatus,
  type IntegrationAdapterInfo,
} from '@autodev/shared-types';
import { logger } from '../../utils/logger.js';
import {
  defaultIntervalTimer,
  type IntegrationAdapter,
  type IntervalTimer,
} from './types.js';

interface RegisteredAdapter {
  adapter: IntegrationAdapter;
  status: AdapterStatus;
  lastHealthCheck?: AdapterHealthResult;
  message?: string;
}

/**
 * Singleton registry for integration adapters.
 * Registration, initialization, and health checks isolate failures per adapter
 * so one broken adapter cannot take down others.
 */
export class AdapterRegistry {
  private readonly adapters = new Map<string, RegisteredAdapter>();
  private healthCheckHandle: unknown | null = null;
  private healthCheckTimer: IntervalTimer = defaultIntervalTimer;
  private healthCheckIntervalMs = DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS;

  register(adapter: IntegrationAdapter): void {
    const name = adapter.name.trim();
    if (!name) {
      throw new Error('Adapter name is required');
    }
    if (this.adapters.has(name)) {
      throw new Error(`Adapter already registered: ${name}`);
    }

    this.adapters.set(name, {
      adapter,
      status: adapter.initialStatus ?? 'inactive',
      ...(adapter.message ? { message: adapter.message } : {}),
    });
  }

  get(name: string): IntegrationAdapter | undefined {
    return this.adapters.get(name)?.adapter;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  list(): IntegrationAdapterInfo[] {
    return [...this.adapters.values()].map((entry) => this.toInfo(entry));
  }

  async initializeAll(): Promise<void> {
    for (const entry of this.adapters.values()) {
      await this.initializeOne(entry);
    }
  }

  async initializeOneByName(name: string): Promise<void> {
    const entry = this.adapters.get(name);
    if (!entry) {
      throw new Error(`Unknown adapter: ${name}`);
    }
    await this.initializeOne(entry);
  }

  /**
   * Runs health checks on all adapters with status `active`.
   * Failures are isolated — one adapter error does not abort the loop.
   */
  async runHealthChecks(): Promise<void> {
    for (const entry of this.adapters.values()) {
      if (entry.status !== 'active') {
        continue;
      }
      await this.healthCheckOne(entry);
    }
  }

  /**
   * Starts periodic health checks. Timer is injectable for tests.
   * Calling again replaces the previous schedule.
   */
  startPeriodicHealthChecks(
    intervalMs: number = DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS,
    timer: IntervalTimer = defaultIntervalTimer,
  ): void {
    this.stopPeriodicHealthChecks();
    this.healthCheckIntervalMs = intervalMs;
    this.healthCheckTimer = timer;
    this.healthCheckHandle = timer.setInterval(() => {
      void this.runHealthChecks().catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'unknown error';
        logger.error(`Periodic adapter health check sweep failed: ${message}`, {
          resource: 'adapter-registry',
          operation: 'healthCheck',
        });
      });
    }, intervalMs);
  }

  stopPeriodicHealthChecks(): void {
    if (this.healthCheckHandle !== null) {
      this.healthCheckTimer.clearInterval(this.healthCheckHandle);
      this.healthCheckHandle = null;
    }
  }

  isHealthCheckRunning(): boolean {
    return this.healthCheckHandle !== null;
  }

  getHealthCheckIntervalMs(): number {
    return this.healthCheckIntervalMs;
  }

  /** Test helper — clears adapters and stops timers. */
  reset(): void {
    this.stopPeriodicHealthChecks();
    this.adapters.clear();
    this.healthCheckTimer = defaultIntervalTimer;
    this.healthCheckIntervalMs = DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS;
  }

  private async initializeOne(entry: RegisteredAdapter): Promise<void> {
    // Stub adapters (e.g. Opsera) stay inactive and skip initialization.
    if (entry.adapter.skipLifecycle) {
      entry.status = entry.adapter.initialStatus ?? 'inactive';
      return;
    }

    try {
      await entry.adapter.initialize();
      entry.status = 'active';
    } catch (error: unknown) {
      entry.status = 'error';
      const message = error instanceof Error ? error.message : 'Initialization failed';
      entry.lastHealthCheck = {
        healthy: false,
        message,
        checkedAt: new Date().toISOString(),
      };
      logger.warn(`Adapter initialize failed: ${entry.adapter.name}: ${message}`, {
        resource: 'adapter-registry',
        operation: 'initialize',
      });
    }
  }

  private async healthCheckOne(entry: RegisteredAdapter): Promise<void> {
    try {
      const result = await entry.adapter.healthCheck();
      entry.lastHealthCheck = {
        healthy: result.healthy,
        ...(result.message ? { message: result.message } : {}),
        checkedAt: new Date().toISOString(),
      };
      entry.status = result.healthy ? 'active' : 'error';
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Health check failed';
      entry.lastHealthCheck = {
        healthy: false,
        message,
        checkedAt: new Date().toISOString(),
      };
      entry.status = 'error';
      logger.warn(`Adapter health check failed: ${entry.adapter.name}: ${message}`, {
        resource: 'adapter-registry',
        operation: 'healthCheck',
      });
    }
  }

  private toInfo(entry: RegisteredAdapter): IntegrationAdapterInfo {
    return {
      name: entry.adapter.name,
      status: entry.status,
      capabilities: entry.adapter.getCapabilities(),
      ...(entry.lastHealthCheck ? { lastHealthCheck: entry.lastHealthCheck } : {}),
      ...(entry.message ? { message: entry.message } : {}),
    };
  }
}

export const adapterRegistry = new AdapterRegistry();
