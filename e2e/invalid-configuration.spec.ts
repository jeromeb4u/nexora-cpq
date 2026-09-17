import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, openQuote, signIn } from './support/session';

test.beforeEach(() => reseed());

test('an invalid product combination is explained and cannot be submitted', async ({ page }) => {
  await signIn(page, ACCOUNTS.rep);

  // QT-10481 is a draft with 10 Gbps fibre and no router — a rule violation.
  await openQuote(page, 'QT-10481');
  await page.getByRole('link', { name: 'Configure' }).click();

  const finding = page.getByText('Connectivity of 10 Gbps requires an Enterprise Router.').first();
  await expect(finding).toBeVisible();
  await expect(page.getByText('Configuration has blocking issues').first()).toBeVisible();

  await page
    .getByRole('button', { name: /Submit/ })
    .first()
    .click();
  await expect(page.getByText('This quote cannot be submitted yet')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Send for approval' })).toHaveCount(0);

  // The server applies the same rule: it will not produce a document either.
  await openQuote(page, 'QT-10481');
  await page.getByRole('button', { name: 'Generate PDF' }).click();
  await expect(page.getByText('The document was not generated')).toBeVisible();
  await expect(page.getByText(/requires an Enterprise Router/).last()).toBeVisible();
});
