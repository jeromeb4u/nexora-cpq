import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, signIn } from './support/session';

test.beforeEach(() => reseed());

test('an approver reads their notifications and clears the unread badge', async ({ page }) => {
  await signIn(page, ACCOUNTS.manager);

  // The bell's accessible name carries the unread count and leads to the list.
  await expect(page.getByRole('link', { name: /Notifications, \d+ unread/ })).toBeVisible();
  await page.getByRole('link', { name: /Notifications/ }).click();

  await expect(page).toHaveURL(/\/notifications/);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible();

  await page.getByRole('button', { name: 'Mark all as read' }).click();
  await expect(page.getByText(/marked read/)).toBeVisible();
  await expect(page.getByText('All caught up')).toBeVisible();

  // Persisted, not just optimistic: the badge is gone after a fresh load.
  await page.goto('/dashboard');
  await expect(page.getByRole('link', { name: /Notifications, \d+ unread/ })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Notifications' })).toBeVisible();
});
