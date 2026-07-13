import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS } from '@autodev/shared-types';
import {
  createFailingHealthMockAdapter,
  createFailingInitMockAdapter,
  createHealthyMockAdapter,
  createUnhealthyMockAdapter,
} from '../../fixtures/integrations.js';
import { AdapterRegistry } from './adapterRegistry.js';
import {
  GitHubIntegrationAdapter,
  JiraIntegrationAdapter,
  OpseraStubAdapter,
} from './adapters/launchAdapters.js';
import { MockIntegrationAdapter } from './adapters/mockAdapter.js';
import type { IntervalTimer } from './types.js';

function createManualTimer(): IntervalTimer & { tick: () => void; cleared: boolean } {
  let callback: (() => void) | null = null;
  return {
    cleared: false,
    setInterval(cb) {
      callback = cb;
      return { id: 'manual' };
    },
    clearInterval() {
      this.cleared = true;
      callback = null;
    },
    tick() {
      callback?.();
    },
  };
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  afterEach(() => {
    registry.reset();
  });

  it('registers adapters and lists status + capabilities', () => {
    const jira = createHealthyMockAdapter('jira', ['ticket-ingest']);
    registry.register(jira);

    expect(registry.has('jira')).toBe(true);
    expect(registry.get('jira')).toBe(jira);
    expect(registry.list()).toEqual([
      {
        name: 'jira',
        status: 'inactive',
        capabilities: ['ticket-ingest'],
      },
    ]);
  });

  it('rejects duplicate adapter names', () => {
    registry.register(createHealthyMockAdapter('jira'));
    expect(() => registry.register(createHealthyMockAdapter('jira'))).toThrow(
      /already registered/i,
    );
  });

  it('initializes adapters and marks them active', async () => {
    const adapter = createHealthyMockAdapter('github');
    registry.register(adapter);

    await registry.initializeAll();

    expect(adapter.initializeCalls).toBe(1);
    expect(registry.list()[0]?.status).toBe('active');
  });

  it('keeps Opsera-style inactive stubs inactive without initialize', async () => {
    const stub = new MockIntegrationAdapter({
      name: 'opsera',
      initialStatus: 'inactive',
      skipLifecycle: true,
      message: 'coming soon',
      capabilities: ['coming soon'],
    });
    registry.register(stub);

    await registry.initializeAll();

    expect(stub.initializeCalls).toBe(0);
    expect(registry.list()[0]).toMatchObject({
      name: 'opsera',
      status: 'inactive',
      capabilities: ['coming soon'],
      message: 'coming soon',
    });
  });

  it('isolates initialize failures so other adapters still activate', async () => {
    const bad = createFailingInitMockAdapter('bad');
    const good = createHealthyMockAdapter('good');
    registry.register(bad);
    registry.register(good);

    await registry.initializeAll();

    const byName = Object.fromEntries(registry.list().map((a) => [a.name, a]));
    expect(byName.bad?.status).toBe('error');
    expect(byName.good?.status).toBe('active');
    expect(good.initializeCalls).toBe(1);
  });

  it('runs health checks only on active adapters and updates status', async () => {
    const active = createHealthyMockAdapter('active');
    const inactive = new MockIntegrationAdapter({
      name: 'inactive',
      initialStatus: 'inactive',
      skipLifecycle: true,
      capabilities: ['coming soon'],
    });
    registry.register(active);
    registry.register(inactive);
    await registry.initializeAll();

    await registry.runHealthChecks();

    expect(active.healthCheckCalls).toBe(1);
    expect(inactive.healthCheckCalls).toBe(0);
    expect(registry.list().find((a) => a.name === 'active')?.lastHealthCheck?.healthy).toBe(true);
  });

  it('isolates health-check throw so siblings remain active', async () => {
    const exploding = createFailingHealthMockAdapter('exploding');
    const healthy = createHealthyMockAdapter('healthy');
    registry.register(exploding);
    registry.register(healthy);
    await registry.initializeAll();

    await registry.runHealthChecks();

    const byName = Object.fromEntries(registry.list().map((a) => [a.name, a]));
    expect(byName.exploding?.status).toBe('error');
    expect(byName.healthy?.status).toBe('active');
    expect(healthy.healthCheckCalls).toBe(1);
  });

  it('marks adapters error when healthCheck returns unhealthy', async () => {
    const unhealthy = createUnhealthyMockAdapter('unhealthy');
    registry.register(unhealthy);
    await registry.initializeAll();

    await registry.runHealthChecks();

    expect(registry.list()[0]?.status).toBe('error');
    expect(registry.list()[0]?.lastHealthCheck?.healthy).toBe(false);
  });

  it('starts periodic health checks with injectable timer (5 min default)', async () => {
    const timer = createManualTimer();
    const adapter = createHealthyMockAdapter('jira');
    registry.register(adapter);
    await registry.initializeAll();

    registry.startPeriodicHealthChecks(DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS, timer);
    expect(registry.isHealthCheckRunning()).toBe(true);
    expect(registry.getHealthCheckIntervalMs()).toBe(DEFAULT_ADAPTER_HEALTH_CHECK_INTERVAL_MS);

    timer.tick();
    await vi.waitFor(() => expect(adapter.healthCheckCalls).toBe(1));

    registry.stopPeriodicHealthChecks();
    expect(timer.cleared).toBe(true);
    expect(registry.isHealthCheckRunning()).toBe(false);
  });

  it('manages launch adapters (Jira, GitHub, Opsera stub) lifecycle together', async () => {
    registry.register(new JiraIntegrationAdapter());
    registry.register(new GitHubIntegrationAdapter());
    registry.register(new OpseraStubAdapter());

    await registry.initializeAll();

    const byName = Object.fromEntries(registry.list().map((a) => [a.name, a]));
    expect(byName.jira?.status).toBe('active');
    expect(byName.github?.status).toBe('active');
    expect(byName.opsera).toMatchObject({
      status: 'inactive',
      capabilities: ['coming soon'],
      message: 'coming soon',
    });

    await registry.runHealthChecks();
    expect(byName.jira && registry.list().find((a) => a.name === 'jira')?.lastHealthCheck?.healthy).toBe(
      true,
    );
    expect(registry.list().find((a) => a.name === 'opsera')?.status).toBe('inactive');
  });
});
