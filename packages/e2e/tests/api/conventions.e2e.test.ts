import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../../backend/src/index.js';
import { getConventionSettingsModel } from '../../../backend/src/models/conventionSettingsModel.js';
import { e2eConventionSettings } from '../../fixtures/auth.js';
import { installE2EApiHarness } from '../../helpers/apiHarness.js';
import { loginAsE2EUser } from '../../helpers/login.js';

installE2EApiHarness();

describe('E2E API · convention setup wizard flow', () => {
  it('loads defaults, saves all convention sections, and passes the prerequisite gate', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsE2EUser(app);

    const defaults = await request(app)
      .get('/api/v1/conventions/defaults')
      .set('Cookie', sessionCookie);
    expect(defaults.status).toBe(200);
    expect(defaults.body.templates.commitMessageFormat).toContain('{ticketKey}');
    expect(defaults.body.availableVariables).toContain('summary');

    const create = await request(app)
      .post('/api/v1/conventions')
      .set('Cookie', sessionCookie)
      .send(e2eConventionSettings);
    expect(create.status).toBe(201);
    expect(create.body.version).toBe(1);
    expect(create.body.isActive).toBe(true);
    expect(create.body.commitMessageFormat).toBe(e2eConventionSettings.commitMessageFormat);
    expect(create.body.branchNamingPattern).toBe(e2eConventionSettings.branchNamingPattern);
    expect(create.body.prTitleTemplate).toBe(e2eConventionSettings.prTitleTemplate);
    expect(create.body.reviewerAssignmentRules.reviewers).toEqual(
      e2eConventionSettings.reviewerAssignmentRules.reviewers,
    );

    const active = await request(app).get('/api/v1/conventions').set('Cookie', sessionCookie);
    expect(active.status).toBe(200);
    expect(active.body.settings.id).toBe(create.body.id);

    const count = await getConventionSettingsModel().countDocuments({ isActive: true });
    expect(count).toBe(1);

    const gated = await request(app)
      .post('/api/v1/test/workflow/start')
      .set('Cookie', sessionCookie);
    expect(gated.status).toBe(200);
    expect(gated.body.ok).toBe(true);
  });

  it('blocks workflow start when conventions are missing', async () => {
    const app = createApp();
    const { sessionCookie } = await loginAsE2EUser(app);

    const blocked = await request(app)
      .post('/api/v1/test/workflow/start')
      .set('Cookie', sessionCookie);
    expect(blocked.status).toBe(403);
  });
});
