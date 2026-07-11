import { describe, expect, it } from 'vitest';
import { AppError } from '../utils/errors.js';
import { assertAllowedUrl, isAllowedUrl } from './urlAllowlist.js';

describe('urlAllowlist', () => {
  it('accepts URLs on allowed hosts', () => {
    expect(isAllowedUrl('https://api.github.com/user', ['github.com'])).toBe(true);
    expect(isAllowedUrl('https://auth.atlassian.com/oauth/token', ['atlassian.com'])).toBe(
      true,
    );
  });

  it('rejects URLs on disallowed hosts and non-http(s) schemes', () => {
    expect(isAllowedUrl('https://evil.example.com/steal', ['github.com'])).toBe(false);
    expect(isAllowedUrl('file:///etc/passwd', ['github.com'])).toBe(false);
    expect(isAllowedUrl('not-a-url', ['github.com'])).toBe(false);
  });

  it('throws AppError when asserting a disallowed URL', () => {
    expect(() => assertAllowedUrl('https://evil.example.com', ['github.com'])).toThrow(AppError);
  });
});
