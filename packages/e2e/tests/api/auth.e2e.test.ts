import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { SESSION_WARNING_MS } from '../../../backend/src/auth/constants.js';
import { buildSessionMetadata } from '../../../backend/src/auth/sessionService.js';
import { createApp } from '../../../backend/src/index.js';
import { getSessionModel } from '../../../backend/src/models/sessionModel.js';
import { installE2EApiHarness } from '../../helpers/apiHarness.js';
import { extractSessionCookie, loginAsE2EUser } from '../../helpers/login.js';

installE2EApiHarness();

describe('E2E API · authentication flow', () => {
  it('covers OAuth login → session → heartbeat → warning signal → logout', async () => {
    const app = createApp();

    const { sessionCookie, loginBody } = await loginAsE2EUser(app);
    expect(loginBody.user.email).toBe('alex.dev@example.com');
    expect(sessionCookie[0]).toContain('autodev_session=');

    const me = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);
    expect(me.status).toBe(200);
    expect(me.body.session.remainingMs).toBeGreaterThan(0);
    expect(me.body.session.warning).toBe(false);

    const heartbeat = await request(app)
      .post('/api/v1/auth/heartbeat')
      .set('Cookie', sessionCookie);
    expect(heartbeat.status).toBe(200);
    expect(heartbeat.body.session.remainingMs).toBeGreaterThan(0);

    const sessionId = sessionCookie[0]!.replace('autodev_session=', '');
    const nearExpiry = new Date(Date.now() + SESSION_WARNING_MS - 30_000);
    await getSessionModel().updateOne({ sessionId }, { $set: { expiresAt: nearExpiry } }).exec();

    const warningMetadata = buildSessionMetadata(sessionId, String(me.body.session.userId), nearExpiry);
    expect(warningMetadata.warning).toBe(true);
    expect(warningMetadata.remainingMs).toBeLessThanOrEqual(SESSION_WARNING_MS);

    const logout = await request(app).post('/api/v1/auth/logout').set('Cookie', sessionCookie);
    expect(logout.status).toBe(204);

    const meAfterLogout = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', extractSessionCookie(logout.headers['set-cookie']).length
        ? extractSessionCookie(logout.headers['set-cookie'])
        : sessionCookie);
    expect(meAfterLogout.status).toBe(401);
  });
});
