import { type Page, expect } from '@playwright/test';

/** Seeded demo accounts. The password is public: it is printed on the sign-in page. */
export const ACCOUNTS = {
  rep: 'sales@nexora.demo',
  manager: 'salesmanager@nexora.demo',
  pricingAdmin: 'pricing@nexora.demo',
  admin: 'admin@nexora.demo',
} as const;

const DEMO_PASSWORD = 'NexoraDemo123!';

export async function signIn(page: Page, email: string): Promise<void> {
  await page.goto('/sign-in');
  await page.getByLabel('Work email').fill(email);
  await page.getByLabel('Password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Open a quote by its number from the quote list (which only lists quotes the user may see). */
export async function openQuote(page: Page, quoteNumber: string): Promise<void> {
  await page.goto(`/quotes?search=${quoteNumber}`);
  await page.getByRole('link', { name: quoteNumber, exact: true }).first().click();
  await expect(page.getByRole('heading', { name: new RegExp(quoteNumber) })).toBeVisible();
}
