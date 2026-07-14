import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession } from '../../helpers/uiStubs.js';

const ARTIFACT_DIR = process.env.AI_MARKETPLACE_ARTIFACT_DIR ?? '/opt/cursor/artifacts';

test.describe('UI · AI Marketplace placeholder (STL-4)', () => {
  test('navigates from the sidebar to the Coming Soon page and highlights the item', async ({
    page,
  }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    const marketplaceLink = page.getByRole('link', { name: 'AI Marketplace' });
    await expect(marketplaceLink).toBeVisible({ timeout: 15_000 });

    await marketplaceLink.click();

    await expect(page).toHaveURL(/\/ai-marketplace$/);
    await expect(page.getByRole('heading', { level: 1, name: 'AI Marketplace' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Coming Soon' })).toBeVisible();
    await expect(page.getByText(/marketplace of ai models and tools/i)).toBeVisible();

    const comingSoon = page.getByRole('region', { name: 'Coming Soon' });
    const backButton = comingSoon.getByRole('link', { name: 'Back to Dashboard', exact: true });
    await expect(backButton).toBeVisible();

    // Active-state highlight for the current route.
    await expect(page.getByRole('link', { name: 'AI Marketplace' })).toHaveClass(/is-active/);
    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-4-ai-marketplace.png`, fullPage: true });

    await backButton.click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('keeps the AI Marketplace item accessible on a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await stubAuthenticatedSession(page);
    await page.goto('/ai-marketplace');

    const marketplaceLink = page.getByRole('link', { name: 'AI Marketplace' });
    await expect(marketplaceLink).toBeVisible({ timeout: 15_000 });
    await expect(marketplaceLink).toHaveClass(/is-active/);
    await expect(page.getByRole('heading', { level: 2, name: 'Coming Soon' })).toBeVisible();

    await page.screenshot({ path: `${ARTIFACT_DIR}/stl-4-ai-marketplace-narrow.png`, fullPage: true });
  });
});
