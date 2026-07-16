import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession } from '../../helpers/uiStubs.js';

const ARTIFACT_DIR = process.env.THEME_ARTIFACT_DIR ?? '/opt/cursor/artifacts';

test.describe('UI · light/dark theme switcher (STL-3)', () => {
  test('toggles theme app-wide and persists across reloads', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await page.goto('dashboard');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
    await expect(toggle).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-3-dashboard-light.png`, fullPage: true });

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-3-dashboard-dark.png`, fullPage: true });

    // Preference persists across reloads with no flash back to light.
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'dark');
  });

  test('login page toggle persists the theme after sign-in (STL-5)', async ({ page }) => {
    await page.route('**/api/v1/auth/prepare-login', (route) =>
      route.fulfill({ status: 204, body: '' }),
    );

    await page.goto('login');
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');

    const toggle = page.getByRole('button', { name: 'Switch to dark theme' });
    await expect(toggle).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-5-login-light.png`, fullPage: true });

    await toggle.click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-5-login-dark.png`, fullPage: true });

    await stubAuthenticatedSession(page);
    await page.goto('dashboard');
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();
  });

  test('unauthenticated login screen respects the stored theme', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem('autodev_theme', 'dark');
      } catch {
        /* storage unavailable — inline script falls back to system default */
      }
    });

    await page.goto('login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-3-login-dark.png`, fullPage: true });
  });
});
