import { describe, expect, it } from 'vitest';
import { generateCodeChallenge, generateCodeVerifier } from './pkce.js';

describe('pkce', () => {
  it('generates a verifier and matching S256 challenge', () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);

    expect(verifier.length).toBeGreaterThan(40);
    expect(challenge).not.toBe(verifier);
    expect(generateCodeChallenge(verifier)).toBe(challenge);
  });
});
