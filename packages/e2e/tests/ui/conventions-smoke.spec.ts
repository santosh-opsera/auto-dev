import { expect, test } from '@playwright/test';
import { stubAuthenticatedSession, stubConventionApis } from '../../helpers/uiStubs.js';

test.describe('UI · convention setup wizard', () => {
  test('walks wizard sections and saves conventions', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await stubConventionApis(page);

    await page.goto('/conventions');

    await expect(
      page.getByRole('heading', { name: /Convention setup wizard|Update conventions/ }),
    ).toBeVisible({ timeout: 15_000 });

    await expect(page.getByRole('tab', { name: 'Commit messages' })).toBeVisible();
    await page.getByRole('tab', { name: 'Branch naming' }).click();
    await expect(page.getByRole('tab', { name: 'Branch naming' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('tab', { name: 'Pull request templates' }).click();
    await page.getByRole('tab', { name: 'Reviewer assignment' }).click();

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/saved|updated|Default conventions/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});
