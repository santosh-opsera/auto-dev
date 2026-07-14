import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession } from '../../helpers/uiStubs.js';
import { seededSessionUser } from '../../fixtures/auth.js';

test.describe('UI · sidebar profile section (STL-1)', () => {
  test('shows the profile entry at the bottom of the sidebar', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    const trigger = page.getByRole('button', {
      name: `Open profile details for ${seededSessionUser.displayName}`,
    });
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(seededSessionUser.displayName);
    await expect(trigger).toContainText(seededSessionUser.email);
  });

  test('opens profile details in place and closes via the close action', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page
      .getByRole('button', { name: `Open profile details for ${seededSessionUser.displayName}` })
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(dialog.getByText('Email', { exact: true })).toBeVisible();
    await expect(dialog.getByText(seededSessionUser.displayName)).toBeVisible();
    await expect(dialog.getByText('Jira integration')).toBeVisible();
    await expect(dialog.getByText('Connected', { exact: true }).first()).toBeVisible();

    await expect(page).toHaveURL(/\/dashboard/);

    await dialog.getByRole('button', { name: 'Close profile details' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('supports keyboard dismissal with Escape', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    await page
      .getByRole('button', { name: `Open profile details for ${seededSessionUser.displayName}` })
      .click();
    await expect(page.getByRole('dialog')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
