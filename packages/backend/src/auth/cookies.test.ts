import { describe, expect, it } from 'vitest';
import { sanitizeOAuthReturnPath } from './cookies.js';

describe('sanitizeOAuthReturnPath', () => {
  it('allows safe relative app paths', () => {
    expect(sanitizeOAuthReturnPath('/tickets')).toBe('/tickets');
    expect(sanitizeOAuthReturnPath('/integrations')).toBe('/integrations');
  });

  it('rejects open redirects and non-paths', () => {
    expect(sanitizeOAuthReturnPath('https://evil.example')).toBeNull();
    expect(sanitizeOAuthReturnPath('//evil.example')).toBeNull();
    expect(sanitizeOAuthReturnPath('\\tickets')).toBeNull();
    expect(sanitizeOAuthReturnPath(undefined)).toBeNull();
  });
});
