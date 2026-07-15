import { expect, test } from '@playwright/test';

const ARTIFACT_DIR = process.env.LOGIN_LOGO_ARTIFACT_DIR ?? '/opt/cursor/artifacts';

test.describe('UI · login page logo (STL-6)', () => {
  test('shows the AutoDev logo on desktop and mobile in light and dark themes', async ({ page }) => {
    const logo = page.getByRole('img', { name: 'AutoDev' });

    await page.goto('/auto-dev/login');
    await expect(logo).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in to AutoDev' })).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-6-login-desktop-light.png`, fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/auto-dev/login');
    await expect(logo).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-6-login-mobile-light.png`, fullPage: true });

    await page.addInitScript(() => {
      try {
        localStorage.setItem('autodev_theme', 'dark');
      } catch {
        /* storage unavailable */
      }
    });

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/auto-dev/login');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(logo).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-6-login-desktop-dark.png`, fullPage: true });
  });
});
