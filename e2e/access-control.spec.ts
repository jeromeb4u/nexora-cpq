import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, openQuote, signIn } from './support/session';

test.beforeEach(() => reseed());

test('users cannot reach pages or quotes outside their role and scope', async ({
  page,
  browser,
}) => {
  // Find the URL of a quote owned by another rep, as someone allowed to see it.
  const managerContext = await browser.newContext();
  const managerPage = await managerContext.newPage();
  await signIn(managerPage, ACCOUNTS.manager);
  await openQuote(managerPage, 'QT-10473');
  const othersQuoteUrl = new URL(managerPage.url()).pathname;
  await managerContext.close();

  await signIn(page, ACCOUNTS.rep);

  // Role: a sales rep has no approval queue.
  await page.goto('/approvals');
  await expect(
    page.getByRole('heading', { name: 'You do not have access to that page' }),
  ).toBeVisible();

  // Scope: another rep's quote is indistinguishable from one that does not exist.
  // (The HTTP status is 200: the route's loading UI has already started
  // streaming when notFound() runs. What matters is that nothing leaks.)
  await page.goto(othersQuoteUrl);
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  await expect(page.getByText('QT-10473')).toHaveCount(0);

  // And it does not appear in their list either.
  await page.goto('/quotes?search=QT-10473');
  await expect(page.getByRole('link', { name: 'QT-10473', exact: true })).toHaveCount(0);

  // Signed out: protected pages send you to sign in.
  await page.context().clearCookies();
  await page.goto('/quotes');
  await expect(page).toHaveURL(/\/sign-in/);
});
