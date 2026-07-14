/**
 * Minimal logging contract for infrastructure modules.
 * Host apps (e.g. backend structured logger) should implement this for EventBus.
 */
export interface Logger {
  /** Informational message with optional structured metadata. */
  info(message: string, meta?: Record<string, unknown>): void;
  /** Warning message with optional structured metadata. */
  warn(message: string, meta?: Record<string, unknown>): void;
  /** Error message with optional structured metadata. */
  error(message: string, meta?: Record<string, unknown>): void;
}

/** No-op {@link Logger} used until the host wires a real logger. */
export const noopLogger: Logger = {
  info() {},
  warn() {},
  error() {},
};
