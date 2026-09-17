import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, signIn } from './support/session';

test.beforeEach(() => reseed());

test('a sales rep creates a customer and site, configures a quote and sends it for approval', async ({
  page,
}) => {
  await signIn(page, ACCOUNTS.rep);

  // --- Platform zone: the customer and their site -------------------------
  await page.goto('/customers');
  await page.getByRole('link', { name: 'New customer' }).click();

  await page.getByLabel('Company name').fill('Nordwind Robotics');
  await page.getByLabel('Legal name').fill('Nordwind Robotics GmbH');
  await page.getByLabel('Industry').selectOption({ index: 1 });
  await page.getByLabel('VAT number').fill('DE998877665');
  await page.getByLabel(/^Email/).fill('it@nordwind-robotics.demo');
  await page.getByLabel('Phone').fill('+49 40 555 0100');
  await page.getByRole('button', { name: 'Create customer' }).click();

  await expect(page.getByRole('heading', { name: /Nordwind Robotics/ })).toBeVisible();

  await page.getByRole('link', { name: 'Add location' }).click();
  await page.getByLabel('Location name').fill('Hamburg Plant');
  await page.getByLabel('Address line 1').fill('Hafenstraße 12');
  await page.getByLabel('City').fill('Hamburg');
  await page.getByLabel('Postal code').fill('20457');
  await page.getByLabel('Contact name').fill('Lena Brandt');
  await page.getByLabel('Contact email').fill('l.brandt@nordwind-robotics.demo');
  await page.getByLabel('Serviceability').selectOption('AVAILABLE');
  await page.getByRole('button', { name: 'Add location' }).click();

  await expect(page.getByText('Hamburg Plant').first()).toBeVisible();

  // --- CPQ zone: the quote ---------------------------------------------------
  await page.goto('/quotes/new');
  await page.getByLabel('Customer').selectOption({ label: 'Nordwind Robotics' });
  await page.getByLabel('Location').selectOption({ label: 'Hamburg Plant — Hamburg' });
  await page.getByLabel('Deal name').fill('Hamburg plant connectivity');
  await page.getByRole('button', { name: 'Create and configure' }).click();

  await expect(page).toHaveURL(/\/quotes\/[^/]+\/configure$/);

  // Connectivity is the first product step the configurator opens on.
  const steps = page.getByRole('navigation', { name: 'Configuration steps' });
  await steps.getByText('Connectivity', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Add Business Fiber 100 Mbps' }).click();
  await expect(page.getByText('Configuration is valid and can be submitted.')).toBeVisible();

  // A 15% discount is above a sales rep's 10% authority.
  await steps.getByText('Pricing', { exact: true }).click();
  const slider = page.getByRole('slider', { name: 'Negotiated discount percentage' });
  await slider.focus();
  await slider.press('Home');
  for (let step = 0; step < 30; step += 1) await slider.press('ArrowRight');
  await expect(page.getByText(/15% exceeds your approval authority/).first()).toBeVisible();

  await page
    .getByLabel('Why is this discount justified?')
    .fill('Three-site roll-out planned next year; competitor has quoted 14%.');

  await steps.getByText('Submit', { exact: true }).click();
  await page.getByRole('button', { name: 'Send for approval' }).click();

  // Back on the quote, now waiting for a manager.
  await expect(page).toHaveURL(/\/quotes\/[^/]+$/);
  await expect(page.getByText('Approval required', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Nordwind Robotics · Hamburg Plant')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Withdraw approval request' })).toBeVisible();
});
