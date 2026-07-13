import type { AdapterStatus } from '@autodev/shared-types';

/** Result of a single adapter health probe (timestamp added by the registry). */
export interface AdapterHealthCheckResult {
  healthy: boolean;
  message?: string;
}

/**
 * Contract for pluggable third-party integrations.
 * Adapter-specific operations live on concrete implementations;
 * the registry only requires lifecycle + discovery methods.
 */
export interface IntegrationAdapter {
  readonly name: string;
  /** Status assigned on registration before initialize/health checks. */
  readonly initialStatus?: AdapterStatus;
  /** Optional note surfaced in the integrations API (e.g. "coming soon"). */
  readonly message?: string;
  /**
   * When true, the registry never activates this adapter (Opsera stub).
   * Initialize and periodic health checks are skipped.
   */
  readonly skipLifecycle?: boolean;
  initialize(): Promise<void>;
  healthCheck(): Promise<AdapterHealthCheckResult>;
  getCapabilities(): string[];
}

/** Injectable timer so unit tests can drive periodic health checks without waiting. */
export interface IntervalTimer {
  setInterval(callback: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export const defaultIntervalTimer: IntervalTimer = {
  setInterval(callback, ms) {
    return setInterval(callback, ms);
  },
  clearInterval(handle) {
    clearInterval(handle as ReturnType<typeof setInterval>);
  },
};
