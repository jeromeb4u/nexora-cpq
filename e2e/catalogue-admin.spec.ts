import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, signIn } from './support/session';

test.beforeEach(() => reseed());

test('a pricing administrator adds a product and a rule, and a rep cannot', async ({
  page,
  browser,
}) => {
  await signIn(page, ACCOUNTS.pricingAdmin);

  // --- A new product ------------------------------------------------------
  await page.goto('/products');
  await page.getByRole('link', { name: 'New product' }).click();

  await page.getByLabel('SKU').fill('TEST-WAVE-1G');
  await page.getByLabel('Name').fill('Wavelength 1 Gbps');
  await page.getByLabel('Description').fill('A dedicated wavelength service for the E2E suite.');
  await page.getByLabel('Category').selectOption('CONNECTIVITY');
  await page.getByLabel('Monthly price (€)').fill('1800.00');
  await page.getByLabel('One-time setup price (€)').fill('750.00');
  await page.getByLabel('Maximum discount (%)').fill('12');
  await page.getByLabel('Bandwidth (Mbps)').fill('1000');
  await page.getByRole('button', { name: 'Add product' }).click();

  await expect(page.getByText('Product added')).toBeVisible();

  await page.goto('/products?search=TEST-WAVE-1G');
  const row = page.getByRole('row').filter({ hasText: 'TEST-WAVE-1G' });
  await expect(row).toContainText('1.800,00 €');
  await expect(row).toContainText('12%');

  // --- Editing it changes the price shown ---------------------------------
  await row.getByRole('link', { name: 'Edit' }).click();
  await page.getByLabel('Monthly price (€)').fill('1950.00');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Product updated')).toBeVisible();

  await page.goto('/products?search=TEST-WAVE-1G');
  await expect(page.getByRole('row').filter({ hasText: 'TEST-WAVE-1G' })).toContainText(
    '1.950,00 €',
  );

  // --- Withdrawing it asks first -----------------------------------------
  await page
    .getByRole('row')
    .filter({ hasText: 'TEST-WAVE-1G' })
    .getByRole('button', { name: 'Withdraw' })
    .click();
  await page.getByRole('button', { name: 'Withdraw product' }).click();
  await expect(page.getByText(/withdrawn/i).first()).toBeVisible();

  await page.goto('/products?search=TEST-WAVE-1G');
  await expect(page.getByRole('row').filter({ hasText: 'TEST-WAVE-1G' })).toContainText(
    'Withdrawn',
  );

  // --- A new rule, previewed as a sentence --------------------------------
  await page.goto('/products/rules');
  await page.getByRole('link', { name: 'New rule' }).click();

  // Role queries, not getByLabel: the visible label carries a required marker,
  // so "Trigger" would also match "Trigger product".
  await page
    .getByRole('combobox', { name: 'Trigger', exact: true })
    .selectOption('BANDWIDTH_AT_LEAST');
  await page.getByRole('spinbutton', { name: 'Bandwidth (Mbps)' }).fill('500');
  await page
    .getByRole('combobox', { name: 'Effect', exact: true })
    .selectOption('RECOMMENDS_PRODUCT');
  // The first real option; index 0 is the "Select a product…" placeholder.
  await page.getByRole('combobox', { name: 'Product', exact: true }).selectOption({ index: 1 });
  await page
    .getByRole('textbox', { name: 'Message' })
    .fill('Circuits of 500 Mbps or more should be protected by a Managed Firewall.');
  await page.getByRole('combobox', { name: 'Severity' }).selectOption('RECOMMENDATION');

  await expect(
    page.getByText(/When connectivity of 500 Mbps or more is selected, recommend/),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add rule' }).click();
  await expect(page.getByText('Rule added')).toBeVisible();

  const ruleRow = page.getByRole('row').filter({ hasText: '500 Mbps or more is selected' });
  await expect(ruleRow).toContainText('Recommendation');

  // Disabling it from the list persists.
  await ruleRow.getByRole('switch').click();
  await expect(page.getByText('Rule disabled')).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('row').filter({ hasText: '500 Mbps or more is selected' }).getByRole('switch'),
  ).toHaveAttribute('aria-checked', 'false');

  // --- A sales rep sees the catalogue but cannot change it ----------------
  const repContext = await browser.newContext();
  const repPage = await repContext.newPage();
  await signIn(repPage, ACCOUNTS.rep);

  await repPage.goto('/products');
  await expect(repPage.getByRole('link', { name: 'New product' })).toHaveCount(0);
  await expect(repPage.getByRole('link', { name: 'Edit' })).toHaveCount(0);

  await repPage.goto('/products/rules');
  await expect(repPage.getByRole('link', { name: 'New rule' })).toHaveCount(0);
  await expect(repPage.getByRole('switch')).toHaveCount(0);

  await repPage.goto('/products/new');
  await expect(
    repPage.getByRole('heading', { name: 'You do not have access to that page' }),
  ).toBeVisible();

  await repContext.close();
});
