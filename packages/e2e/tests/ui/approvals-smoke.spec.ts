import { expect, test } from '@playwright/test';
import {
  stubApprovalApis,
  stubAuthenticatedSession,
} from '../../helpers/uiStubs.js';

test.describe('UI · approval gate', () => {
  test('shows divergences/gaps and clears the gate after decisions', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await stubApprovalApis(page);

    await page.goto('/approvals/approval-e2e-001');
    await expect(page.getByRole('heading', { name: 'Approval gate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Gaps/ })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: /Divergences/ })).toBeVisible();
    await expect(page.getByText('Ticket approach').first()).toBeVisible();
    await expect(page.getByText('Codebase convention').first()).toBeVisible();

    const cards = page.locator('.approval-item-card');
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);

    for (let index = 0; index < cardCount; index += 1) {
      const card = cards.nth(index);
      const isDivergence = (await card.getAttribute('class'))?.includes('divergence') ?? false;

      if (isDivergence) {
        await card.getByRole('button', { name: 'Modify' }).click();
        await card.getByLabel(/Rationale/).fill('Align with codebase naming.');
        await card.getByLabel(/Modified value/).fill('Adopt codebase naming');
        await card.getByRole('button', { name: 'Confirm Modify' }).click();
      } else {
        await card.getByRole('button', { name: 'Approve' }).click();
        await card.getByRole('button', { name: 'Confirm Approve' }).click();
      }
    }

    await expect(
      page.getByText('All items are resolved. You can proceed to implementation.'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Proceed to Implementation' })).toBeEnabled();
    await page.getByRole('button', { name: 'Proceed to Implementation' }).click();
  });
});
