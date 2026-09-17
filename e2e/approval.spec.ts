import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, openQuote, signIn } from './support/session';

test.beforeEach(() => reseed());

test('a sales manager approves an escalated discount from the approval queue', async ({ page }) => {
  await signIn(page, ACCOUNTS.manager);
  await page.goto('/approvals');

  // The approver sees the rep's justification before deciding.
  await expect(
    page.getByText('Competitive bid against the incumbent.', { exact: false }),
  ).toBeVisible();

  // The smallest element holding both this quote's link and an Approve button
  // is that request's header, so the click cannot land on another request.
  const request = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: 'QT-10482', exact: true }) })
    .filter({ has: page.getByRole('button', { name: 'Approve' }) })
    .last();
  await request.getByRole('button', { name: 'Approve' }).click();

  await expect(page.getByText('QT-10482 approved')).toBeVisible();

  await openQuote(page, 'QT-10482');
  await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Sarah Klein').first()).toBeVisible();
});
