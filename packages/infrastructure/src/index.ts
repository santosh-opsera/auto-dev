/** Package name constant for diagnostics and discoverability. */
export const INFRASTRUCTURE_PACKAGE = '@autodev/infrastructure' as const;

export { CircuitBreaker, type CircuitState } from './circuitBreaker.js';
export {
  EventBus,
  eventBus,
  type EventHandler,
} from './eventBus.js';
export { noopLogger, type Logger } from './logger.js';
export {
  cryptographicallyErase,
  cryptographicallyEraseSecret,
  decryptConfidentialField,
  decryptConfidentialFields,
  decryptOAuthToken,
  decryptRestricted,
  decryptSecret,
  decryptWithPerRecordDek,
  encryptConfidentialField,
  encryptConfidentialFields,
  encryptOAuthToken,
  encryptRestricted,
  encryptSecret,
  encryptWithPerRecordDek,
  ERASED_DEK_MARKER,
  getKek,
  hashValue,
  unwrapDek,
  wrapDek,
  type WrappedEncryptedPayload,
} from './encryption.js';
export { type AuditFields } from './auditFields.js';
export { BaseRepository } from './baseRepository.js';
export { systemClock, type Clock } from './clock.js';
export {
  DEFAULT_RETRY_DELAYS_MS,
  isRetryableHttpStatus,
  sleep,
  withRetry,
  type WithRetryOptions,
} from './retry.js';
