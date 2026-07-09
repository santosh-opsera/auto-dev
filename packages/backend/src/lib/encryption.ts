import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY ?? 'dev-only-encryption-key-change-me';
  return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64url')}.${authTag.toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptSecret(payload: string): string {
  const [ivPart, authTagPart, encryptedPart] = payload.split('.');

  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('Invalid encrypted payload format');
  }

  const decipher = createDecipheriv(
    ALGORITHM,
    getEncryptionKey(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64url'));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

export function hashValue(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
