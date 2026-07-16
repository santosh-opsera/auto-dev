import { expect, test } from '@playwright/test';

const ARTIFACT_DIR = process.env.LOGIN_GITHUB_ICON_ARTIFACT_DIR ?? '/opt/cursor/artifacts';

test.describe('UI · GitHub sign-in icon (STL-7)', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/v1/auth/prepare-login', (route) =>
      route.fulfill({ status: 204, body: '' }),
    );
  });

  test('shows GitHub icon on the sign-in button in light and dark themes', async ({ page }) => {
    await page.goto('login');

    const githubButton = page.getByRole('button', { name: 'Continue with GitHub' });
    await expect(githubButton).toBeVisible();
    await expect(githubButton.getByTestId('github-sign-in-icon')).toBeVisible();

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'light');
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-7-login-github-icon-light.png`, fullPage: true });

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'dark');
    await expect(githubButton.getByTestId('github-sign-in-icon')).toBeVisible();
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-7-login-github-icon-dark.png`, fullPage: true });
  });
});
