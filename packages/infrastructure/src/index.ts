/** Scaffold barrel for shared infrastructure modules (WO-028 / P14). */
export const INFRASTRUCTURE_PACKAGE = '@autodev/infrastructure' as const;

export { CircuitBreaker, type CircuitState } from './circuitBreaker.js';
export {
  EventBus,
  eventBus,
  type EventHandler,
} from './eventBus.js';
export { noopLogger, type Logger } from './logger.js';
