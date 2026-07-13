import type { HealthCheckResult } from '@autodev/shared-types';

export interface HealthChecker {
  check(url: string): Promise<{ ok: boolean; statusCode?: number; error?: string }>;
}

export class FetchHealthChecker implements HealthChecker {
  async check(url: string): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
    try {
      const response = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(5_000),
      });
      return {
        ok: response.ok,
        statusCode: response.status,
        error: response.ok ? undefined : `Health check returned ${response.status}`,
      };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Health check failed',
      };
    }
  }
}

export interface MockHealthCheckerOptions {
  /** Sequence of outcomes per attempt; last value repeats. */
  outcomes?: Array<{ ok: boolean; statusCode?: number; error?: string }>;
}

export class MockHealthChecker implements HealthChecker {
  private attempt = 0;
  private readonly outcomes: Array<{ ok: boolean; statusCode?: number; error?: string }>;

  constructor(options: MockHealthCheckerOptions = {}) {
    this.outcomes = options.outcomes ?? [{ ok: true, statusCode: 200 }];
  }

  async check(_url: string): Promise<{ ok: boolean; statusCode?: number; error?: string }> {
    const index = Math.min(this.attempt, this.outcomes.length - 1);
    this.attempt += 1;
    return this.outcomes[index]!;
  }
}

export interface WaitForHealthyOptions {
  url: string;
  maxAttempts?: number;
  delayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  checker: HealthChecker;
}

/**
 * Polls a health endpoint until healthy or attempts are exhausted.
 * Deployment must not transition to RUNNING until this succeeds.
 */
export async function waitForHealthy(options: WaitForHealthyOptions): Promise<HealthCheckResult> {
  const maxAttempts = options.maxAttempts ?? 5;
  const delayMs = options.delayMs ?? 0;
  const sleep =
    options.sleep ??
    (async (ms: number) => {
      if (ms > 0) {
        await new Promise((resolve) => setTimeout(resolve, ms));
      }
    });

  let lastError: string | undefined;
  let lastStatus: number | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await options.checker.check(options.url);
    lastStatus = result.statusCode;
    if (result.ok) {
      return {
        healthy: true,
        statusCode: result.statusCode,
        url: options.url,
        attempts: attempt,
      };
    }
    lastError = result.error ?? 'Health check failed';
    if (attempt < maxAttempts) {
      await sleep(delayMs);
    }
  }

  return {
    healthy: false,
    statusCode: lastStatus,
    url: options.url,
    attempts: maxAttempts,
    lastError,
  };
}

export function buildHealthCheckUrl(baseUrl: string, healthCheckPath: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  const path = healthCheckPath.startsWith('/') ? healthCheckPath : `/${healthCheckPath}`;
  return `${base}${path}`;
}
