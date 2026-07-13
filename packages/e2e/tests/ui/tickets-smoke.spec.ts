import { expect, test } from '@playwright/test';
import {
  stubAuthenticatedSession,
  stubTicketApis,
} from '../../helpers/uiStubs.js';

test.describe('UI · ticket ingestion', () => {
  test('select → parse → show intent and proceed without gaps', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await stubTicketApis(page, false);

    await page.goto('/tickets');
    await expect(page.getByRole('heading', { name: 'Ticket ingestion' })).toBeVisible();

    await page.getByLabel('Ticket key').fill('OPL-1234');
    await page.getByRole('button', { name: 'Load and parse ticket' }).click();

    await expect(page.getByText('Ticket is ready to proceed to codebase analysis', { exact: false })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('detects critical gaps after parse', async ({ page }) => {
    await stubAuthenticatedSession(page);
    await stubTicketApis(page, true);

    await page.goto('/tickets');
    await page.getByLabel('Ticket key').fill('OPL-2001');
    await page.getByRole('button', { name: 'Load and parse ticket' }).click();

    await expect(
      page.getByText('Resolve critical gaps before proceeding to codebase analysis.'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/acceptance criteria/i).first()).toBeVisible();
  });
});
