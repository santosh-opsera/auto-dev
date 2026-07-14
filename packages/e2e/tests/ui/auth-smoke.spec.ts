import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession } from '../../helpers/uiStubs.js';
import { warningSessionMetadata } from '../../fixtures/auth.js';

test.describe('UI · auth session smoke', () => {
  test('login page renders OAuth entry points without real secrets', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with GitHub' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue with Atlassian' })).toHaveCount(0);
  });

  test('seeded session shows warning modal then logout returns to login', async ({ page }) => {
    await stubAuthenticatedSession(page, { warning: true });
    await page.goto('/dashboard');

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Session expiring soon' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Log out', exact: true }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeVisible();
  });

  test('extend session dismisses the warning modal', async ({ page }) => {
    await stubAuthenticatedSession(page, { warning: true });

    let extendNextHeartbeat = false;
    await page.route('**/api/v1/auth/heartbeat', async (route) => {
      const session = extendNextHeartbeat
        ? {
            remainingMs: 23 * 60 * 60 * 1000,
            warning: false,
            expiresAt: new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString(),
          }
        : warningSessionMetadata;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          session,
          warning: session.warning
            ? 'Your session will expire in less than 5 minutes.'
            : undefined,
        }),
      });
    });

    await page.goto('/dashboard');
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Session expiring soon' })).toBeVisible();

    extendNextHeartbeat = true;
    await dialog.getByRole('button', { name: 'Extend session' }).click();
    await expect(page.getByRole('heading', { name: 'Session expiring soon' })).toHaveCount(0);
  });
});
