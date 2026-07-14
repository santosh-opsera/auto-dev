import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH = 32;
const GCM_OPTIONS = { authTagLength: AUTH_TAG_LENGTH };
const DEFAULT_DEV_KEY = 'dev-only-encryption-key-change-me';

/** Marker stored in place of a destroyed wrapped DEK after cryptographic erasure. */
export const ERASED_DEK_MARKER = 'ERASED';

export interface WrappedEncryptedPayload {
  /** Ciphertext encrypted with a per-record DEK (iv.authTag.ciphertext base64url). */
  ciphertext: string;
  /** DEK wrapped with the environment KEK, or {@link ERASED_DEK_MARKER} after erasure. */
  wrappedDek: string;
  erased: boolean;
}

/** Resolve the 256-bit KEK from an explicit secret or ENCRYPTION_KEY / dev default. */
export function getKek(encryptionKey?: string): Buffer {
  const secret = encryptionKey ?? process.env.ENCRYPTION_KEY ?? DEFAULT_DEV_KEY;
  return createHash('sha256').update(secret).digest();
}

function packPayload(iv: Buffer, authTag: Buffer, encrypted: Buffer): string {
  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

function unpackPayload(payload: string): { iv: Buffer; authTag: Buffer; encrypted: Buffer } {
  const [ivPart, authTagPart, encryptedPart] = payload.split('.');

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Invalid encrypted payload format');
  }

  const authTag = Buffer.from(authTagPart, 'base64url');
  if (authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error(`Invalid auth tag length: expected ${AUTH_TAG_LENGTH}, got ${authTag.length}`);
  }

  return {
    iv: Buffer.from(ivPart, 'base64url'),
    authTag,
    encrypted: Buffer.from(encryptedPart, 'base64url'),
  };
}

function encryptWithKey(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, GCM_OPTIONS);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return packPayload(iv, cipher.getAuthTag(), encrypted);
}

function decryptWithKey(payload: string, key: Buffer): string {
  const { iv, authTag, encrypted } = unpackPayload(payload);
  const decipher = createDecipheriv(ALGORITHM, key, iv, GCM_OPTIONS);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/**
 * Encrypt Restricted data (OAuth tokens, API keys) with AES-256-GCM.
 * Uses ENCRYPTION_KEY from the environment (hashed to 256-bit KEK).
 */
export function encryptSecret(plaintext: string, encryptionKey?: string): string {
  return encryptWithKey(plaintext, getKek(encryptionKey));
}

/**
 * Decrypt a payload produced by {@link encryptSecret}.
 * @param payload - Packed iv.authTag.ciphertext string
 * @param encryptionKey - Optional KEK secret override
 */
export function decryptSecret(payload: string, encryptionKey?: string): string {
  return decryptWithKey(payload, getKek(encryptionKey));
}

/** Alias for Restricted-tier at-rest encryption (AES-256-GCM). */
export const encryptRestricted = encryptSecret;
export const decryptRestricted = decryptSecret;

/** OAuth token alias over Restricted AES-256-GCM encryption. */
export const encryptOAuthToken = encryptSecret;
export const decryptOAuthToken = decryptSecret;

/**
 * Field-level encryption for Confidential data (profiles, emails).
 * Uses the same AES-256-GCM primitive with a purpose-bound key derivation.
 */
export function encryptConfidentialField(plaintext: string, encryptionKey?: string): string {
  const fieldKey = createHash('sha256')
    .update(Buffer.concat([getKek(encryptionKey), Buffer.from('confidential')]))
    .digest();
  return encryptWithKey(plaintext, fieldKey);
}

export function decryptConfidentialField(payload: string, encryptionKey?: string): string {
  const fieldKey = createHash('sha256')
    .update(Buffer.concat([getKek(encryptionKey), Buffer.from('confidential')]))
    .digest();
  return decryptWithKey(payload, fieldKey);
}

export function encryptConfidentialFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly (keyof T & string)[],
  encryptionKey?: string,
): T {
  const next = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === 'string' && value.length > 0) {
      next[field] = encryptConfidentialField(value, encryptionKey) as T[typeof field];
    }
  }
  return next;
}

export function decryptConfidentialFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly (keyof T & string)[],
  encryptionKey?: string,
): T {
  const next = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === 'string' && value.length > 0) {
      next[field] = decryptConfidentialField(value, encryptionKey) as T[typeof field];
    }
  }
  return next;
}

export function wrapDek(dek: Buffer, encryptionKey?: string): string {
  return encryptWithKey(dek.toString('base64url'), getKek(encryptionKey));
}

export function unwrapDek(wrappedDek: string, encryptionKey?: string): Buffer {
  if (wrappedDek === ERASED_DEK_MARKER) {
    throw new Error('Data encryption key has been destroyed (cryptographic erasure)');
  }
  return Buffer.from(decryptWithKey(wrappedDek, getKek(encryptionKey)), 'base64url');
}

/**
 * Encrypt with a per-record DEK wrapped by the environment KEK.
 * Destroying the wrapped DEK renders ciphertext permanently unrecoverable.
 */
export function encryptWithPerRecordDek(
  plaintext: string,
  encryptionKey?: string,
): WrappedEncryptedPayload {
  const dek = randomBytes(DEK_LENGTH);
  try {
    const ciphertext = encryptWithKey(plaintext, dek);
    const wrappedDek = wrapDek(dek, encryptionKey);
    return { ciphertext, wrappedDek, erased: false };
  } finally {
    dek.fill(0);
  }
}

export function decryptWithPerRecordDek(
  payload: WrappedEncryptedPayload,
  encryptionKey?: string,
): string {
  if (payload.erased || payload.wrappedDek === ERASED_DEK_MARKER) {
    throw new Error('Data encryption key has been destroyed (cryptographic erasure)');
  }
  const dek = unwrapDek(payload.wrappedDek, encryptionKey);
  try {
    return decryptWithKey(payload.ciphertext, dek);
  } finally {
    dek.fill(0);
  }
}

/**
 * Cryptographic erasure: destroy wrapped DEK material so ciphertext cannot be recovered.
 * Does not soft-delete — the ciphertext may remain but is unrecoverable.
 */
export function cryptographicallyErase(
  payload: WrappedEncryptedPayload,
): WrappedEncryptedPayload {
  return {
    ciphertext: payload.ciphertext,
    wrappedDek: ERASED_DEK_MARKER,
    erased: true,
  };
}

export const cryptographicallyEraseSecret = cryptographicallyErase;

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
