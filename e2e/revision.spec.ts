import { expect, test } from '@playwright/test';

import { reseed } from './support/database';
import { ACCOUNTS, openQuote, signIn } from './support/session';

test.beforeEach(() => reseed());

test('restoring an old version adds a new version and leaves history unchanged', async ({
  page,
}) => {
  await signIn(page, ACCOUNTS.rep);
  await openQuote(page, 'QT-10482');

  const history = page
    .locator('table')
    .filter({ has: page.getByRole('columnheader', { name: 'Version' }) });
  const row = (label: string) =>
    history.getByRole('row').filter({ has: page.getByRole('cell', { name: label, exact: true }) });

  const v1Before = await row('v1').innerText();
  const figures = async (label: string) =>
    (await row(label).getByRole('cell').allInnerTexts()).slice(0, 7);
  const v3Before = await figures('v3');
  await expect(history.getByRole('row')).toHaveCount(4); // header + three versions

  await row('v1').getByRole('button', { name: 'Restore' }).click();
  await page.getByRole('button', { name: 'Restore as new version' }).click();
  await expect(page.getByText('Version 1 restored as version 4')).toBeVisible();

  await expect(history.getByRole('row')).toHaveCount(5);
  await expect(row('v4').getByText('Current')).toBeVisible();

  // The copied version carries the same figures as its source...
  const cells = async (label: string) =>
    (await row(label).getByRole('cell').allInnerTexts()).slice(1, 5);
  expect(await cells('v4')).toEqual(await cells('v1'));

  // ...and the versions that already existed are unchanged. v1 was already
  // superseded, so its whole row is identical; v3 keeps every figure and only
  // changes from Current to Superseded.
  expect(await row('v1').innerText()).toBe(v1Before);
  expect(await figures('v3')).toEqual(v3Before);
  await expect(row('v3').getByText('Superseded')).toBeVisible();

  // Restoring re-enters configuration; the pending approval was withdrawn.
  await expect(page.getByText('Configuring', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Withdrawn', { exact: true }).first()).toBeVisible();
});
