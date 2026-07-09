import { createHash, randomBytes } from 'node:crypto';

function base64UrlEncode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export function generateCodeVerifier(): string {
  return base64UrlEncode(randomBytes(32));
}

export function generateCodeChallenge(codeVerifier: string): string {
  return base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
}

export function generateStateToken(): string {
  return base64UrlEncode(randomBytes(16));
}
