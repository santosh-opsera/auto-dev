import { describe, expect, it } from 'vitest';
import {
  cryptographicallyErase,
  cryptographicallyEraseSecret,
  decryptConfidentialField,
  decryptConfidentialFields,
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
} from './encryption.js';

describe('encryption', () => {
  it('encrypts and decrypts secrets with AES-256-GCM', () => {
    const encrypted = encryptSecret('github-access-token');
    expect(encrypted).not.toContain('github-access-token');

    const decrypted = decryptSecret(encrypted);
    expect(decrypted).toBe('github-access-token');
  });

  it('accepts an explicit KEK secret via getKek / encryptSecret', () => {
    const key = 'unit-test-encryption-key';
    expect(getKek(key).equals(getKek(key))).toBe(true);

    const encrypted = encryptSecret('token', key);
    expect(decryptSecret(encrypted, key)).toBe('token');
    expect(() => decryptSecret(encrypted, 'other-key')).toThrow();
  });

  it('exposes Restricted and OAuth aliases for AES-256-GCM at-rest encryption', () => {
    const encrypted = encryptRestricted('gho_oauth_token');
    expect(encrypted).not.toContain('gho_oauth_token');
    expect(decryptRestricted(encrypted)).toBe('gho_oauth_token');
    expect(decryptSecret(encryptOAuthToken('gho_oauth_token'))).toBe('gho_oauth_token');
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

  it('encrypts Confidential fields at field level', () => {
    const encrypted = encryptConfidentialField('alex.dev@example.com');
    expect(encrypted).not.toContain('alex.dev');
    expect(decryptConfidentialField(encrypted)).toBe('alex.dev@example.com');

    const profile = encryptConfidentialFields(
      { email: 'dana.lead@example.com', displayName: 'Dana Lead', role: 'admin' },
      ['email', 'displayName'],
    );
    expect(profile.email).not.toContain('dana.lead');
    expect(profile.displayName).not.toContain('Dana');
    expect(profile.role).toBe('admin');

    const decrypted = decryptConfidentialFields(profile, ['email', 'displayName']);
    expect(decrypted).toEqual({
      email: 'dana.lead@example.com',
      displayName: 'Dana Lead',
      role: 'admin',
    });
  });

  it('supports cryptographic erasure via per-record DEK destruction', () => {
    const payload = encryptWithPerRecordDek('user-profile-secret');
    expect(payload.erased).toBe(false);
    expect(decryptWithPerRecordDek(payload)).toBe('user-profile-secret');

    const erased = cryptographicallyEraseSecret(payload);
    expect(erased.erased).toBe(true);
    expect(erased.wrappedDek).toBe(ERASED_DEK_MARKER);
    expect(erased.ciphertext).toBe(payload.ciphertext);
    expect(() => decryptWithPerRecordDek(erased)).toThrow(/destroyed/);
    expect(cryptographicallyErase(payload).erased).toBe(true);
  });

  it('wraps and unwraps DEK material', () => {
    const dek = Buffer.alloc(32, 7);
    const wrapped = wrapDek(dek);
    expect(unwrapDek(wrapped).equals(dek)).toBe(true);
  });
});
