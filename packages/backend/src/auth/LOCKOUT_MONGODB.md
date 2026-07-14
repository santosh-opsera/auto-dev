# WO-018 verification

MongoDB TTL lockout was delivered in WO-005 (PR #54). This note confirms
WO-018 acceptance criteria against the current codebase:

- `auth_lockouts` collection with TTL on `expiresAt` (`expireAfterSeconds: 0`)
- Shared across instances via MongoDB (`lockoutService` + `lockoutModel`)
- 423 `AccountLocked` with Retry-After (authAuditHelpers / errorHandler)
- API unchanged: `isLockedOut`, `recordAuthFailure`, `clearAuthFailures`
- Unit + mongodb-memory-server coverage + fixtures under `fixtures/lockout.ts`
