import type { Application } from 'express';
import request from 'supertest';

export function extractSessionCookie(setCookie: string[] | string | undefined): string[] {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const session = headers.find((cookie) => cookie.startsWith('autodev_session='));
  return session ? [session.split(';')[0] ?? ''] : [];
}

export function extractCookieJar(setCookie: string[] | string | undefined): string {
  const headers = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
  const jar = new Map<string, string>();

  for (const header of headers) {
    const [pair] = header.split(';');
    const [name, ...valueParts] = pair.split('=');
    jar.set(name.trim(), valueParts.join('=').trim());
  }

  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

export async function loginAsE2EUser(app: Application): Promise<{
  sessionCookie: string[];
  cookieJar: string;
  loginBody: { user: { email: string } };
}> {
  const login = await request(app)
    .post('/api/v1/auth/github/callback')
    .send({ code: 'e2e-mock-code', code_verifier: 'e2e-mock-verifier' });

  if (login.status !== 200) {
    throw new Error(`E2E login failed with status ${login.status}: ${JSON.stringify(login.body)}`);
  }

  return {
    sessionCookie: extractSessionCookie(login.headers['set-cookie']),
    cookieJar: extractCookieJar(login.headers['set-cookie']),
    loginBody: login.body as { user: { email: string } },
  };
}
