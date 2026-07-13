import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH = 32;
const GCM_OPTIONS = { authTagLength: AUTH_TAG_LENGTH };

/** Marker stored in place of a destroyed wrapped DEK after cryptographic erasure. */
export const ERASED_DEK_MARKER = 'ERASED';

export interface WrappedEncryptedPayload {
  /** Ciphertext encrypted with a per-record DEK (iv.authTag.ciphertext base64url). */
  ciphertext: string;
  /** DEK wrapped with the environment KEK, or {@link ERASED_DEK_MARKER} after erasure. */
  wrappedDek: string;
  erased: boolean;
}

function getKek(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? 'dev-only-encryption-key-change-me';
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
export function encryptSecret(plaintext: string): string {
  return encryptWithKey(plaintext, getKek());
}

export function decryptSecret(payload: string): string {
  return decryptWithKey(payload, getKek());
}

/** Alias for Restricted-tier at-rest encryption (AES-256-GCM). */
export const encryptRestricted = encryptSecret;
export const decryptRestricted = decryptSecret;

/**
 * Field-level encryption for Confidential data (profiles, emails).
 * Uses the same AES-256-GCM primitive with a purpose-bound key derivation.
 */
export function encryptConfidentialField(plaintext: string): string {
  const fieldKey = createHash('sha256').update(Buffer.concat([getKek(), Buffer.from('confidential')])).digest();
  return encryptWithKey(plaintext, fieldKey);
}

export function decryptConfidentialField(payload: string): string {
  const fieldKey = createHash('sha256').update(Buffer.concat([getKek(), Buffer.from('confidential')])).digest();
  return decryptWithKey(payload, fieldKey);
}

export function encryptConfidentialFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly (keyof T & string)[],
): T {
  const next = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === 'string' && value.length > 0) {
      next[field] = encryptConfidentialField(value) as T[typeof field];
    }
  }
  return next;
}

export function decryptConfidentialFields<T extends Record<string, unknown>>(
  record: T,
  fields: readonly (keyof T & string)[],
): T {
  const next = { ...record };
  for (const field of fields) {
    const value = next[field];
    if (typeof value === 'string' && value.length > 0) {
      next[field] = decryptConfidentialField(value) as T[typeof field];
    }
  }
  return next;
}

function wrapDek(dek: Buffer): string {
  return encryptWithKey(dek.toString('base64url'), getKek());
}

function unwrapDek(wrappedDek: string): Buffer {
  if (wrappedDek === ERASED_DEK_MARKER) {
    throw new Error('Data encryption key has been destroyed (cryptographic erasure)');
  }
  return Buffer.from(decryptWithKey(wrappedDek, getKek()), 'base64url');
}

/**
 * Encrypt with a per-record DEK wrapped by the environment KEK.
 * Destroying the wrapped DEK renders ciphertext permanently unrecoverable.
 */
export function encryptWithPerRecordDek(plaintext: string): WrappedEncryptedPayload {
  const dek = randomBytes(DEK_LENGTH);
  try {
    const ciphertext = encryptWithKey(plaintext, dek);
    const wrappedDek = wrapDek(dek);
    return { ciphertext, wrappedDek, erased: false };
  } finally {
    dek.fill(0);
  }
}

export function decryptWithPerRecordDek(payload: WrappedEncryptedPayload): string {
  if (payload.erased || payload.wrappedDek === ERASED_DEK_MARKER) {
    throw new Error('Data encryption key has been destroyed (cryptographic erasure)');
  }
  const dek = unwrapDek(payload.wrappedDek);
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

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
