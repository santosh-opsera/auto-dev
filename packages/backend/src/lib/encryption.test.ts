import { describe, expect, it } from 'vitest';
import { decryptSecret, encryptSecret, hashValue } from './encryption.js';

describe('encryption', () => {
  it('encrypts and decrypts secrets with AES-256-GCM', () => {
    const encrypted = encryptSecret('github-access-token');
    expect(encrypted).not.toContain('github-access-token');

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe('github-access-token');
  });

  it('rejects ciphertext with a short auth tag', () => {
    const encrypted = encryptSecret('github-access-token');
    const [ivPart, authTagPart, encryptedPart] = encrypted.split('.');
    const shortTag = authTagPart.slice(0, 8);

    expect(() => decryptSecret(`${ivPart}.${shortTag}.${encryptedPart}`)).toThrow(
      /Invalid auth tag length/,
    );
  });

  it('hashes values deterministically', () => {
    expect(hashValue('refresh-token')).toBe(hashValue('refresh-token'));
    expect(hashValue('refresh-token')).not.toBe(hashValue('other-token'));
  });
});
