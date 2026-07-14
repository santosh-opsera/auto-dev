import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession } from '../../helpers/uiStubs.js';
import { seededSessionUser } from '../../fixtures/auth.js';

test.describe('UI · sidebar height (STL-2)', () => {
  // Use a short viewport so the main content is taller than the screen. This is
  // the condition that previously stretched the sidebar and pushed the profile
  // section below the fold.
  test.use({ viewport: { width: 1280, height: 500 } });

  test('keeps the profile section within the viewport on load without scrolling', async ({
    page,
  }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    const trigger = page.getByRole('button', {
      name: `Open profile details for ${seededSessionUser.displayName}`,
    });
    await expect(trigger).toBeVisible();
    await expect(trigger).toBeInViewport();
  });

  test('sizes the sidebar to the viewport height rather than the page height', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await page.goto('/dashboard');

    const sidebar = page.locator('.sidebar-nav');
    await expect(sidebar).toBeVisible();

    const viewportHeight = page.viewportSize()?.height ?? 0;
    const sidebarHeight = await sidebar.evaluate((el) => el.getBoundingClientRect().height);

    expect(viewportHeight).toBeGreaterThan(0);
    // The sidebar must occupy only the height of the screen, not grow with the
    // taller main content behind it.
    expect(sidebarHeight).toBeLessThanOrEqual(viewportHeight + 1);
  });
});
