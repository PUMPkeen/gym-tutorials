import { expect, test } from '@playwright/test';
import { BENCH, fixture, importClips, openLibrary, SQUAT, THRUST } from './helpers';

test('first run: empty library offers Add and Restore, Start workout is disabled', async ({ page }) => {
  await openLibrary(page);
  await expect(page.getByRole('button', { name: 'Add your first clips' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Start workout/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Restore from backup' }).click();
  await expect(page.getByText('Pick backup file')).toBeVisible();
});

test('import: picked clips land in the Library under main and extra groups', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [SQUAT, THRUST, BENCH]);
  await expect(page.getByTestId('clip-thumb')).toHaveCount(3);
  // Squat (main Quads, extra Glutes) is listed under both groups.
  await page.getByRole('button', { name: 'Glutes 2' }).click();
  await expect(page.getByTestId('clip-thumb')).toHaveCount(2);
  await page.getByRole('button', { name: 'Quads 1' }).click();
  await expect(page.getByRole('button', { name: 'Edit Goblet squat' })).toBeVisible();
});

test('import: an unplayable file is refused with a message, good files still save', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByTestId('pick-videos').setInputFiles([fixture('broken.webm'), fixture(THRUST.file)]);
  await expect(page.getByText(/“broken.webm” was skipped/)).toBeVisible();
  await page.getByRole('radiogroup', { name: 'Main group' }).getByRole('radio', { name: 'Glutes', exact: true }).click();
  await page.getByRole('button', { name: 'Save & next' }).click();
  await expect(page.getByText('Import finished')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByTestId('clip-thumb')).toHaveCount(1);
});

test('import: typing a name and then quickly toggling trim keeps the typed name', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByTestId('pick-videos').setInputFiles([fixture(THRUST.file)]);
  await page.getByRole('textbox', { name: 'Name' }).fill('Hip thrust');
  await page.getByText('Loop only the movement').click();
  await page.getByRole('radiogroup', { name: 'Main group' }).getByRole('radio', { name: 'Glutes', exact: true }).click();
  await page.getByRole('button', { name: 'Save & next' }).click();
  await expect(page.getByRole('button', { name: 'Edit Hip thrust' })).toBeVisible();
});

test('import: re-adding the same video shows a duplicate warning', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [THRUST]);
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByTestId('pick-videos').setInputFiles([fixture(THRUST.file)]);
  await expect(page.getByText('Looks like a duplicate of “Hip thrust”')).toBeVisible();
});

test('edit: rename, trim and delete a clip', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [THRUST, BENCH]);
  await page.getByRole('button', { name: 'Edit Hip thrust' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Barbell hip thrust');
  await page.getByText('Loop only the movement').click();
  await page.getByRole('slider', { name: 'Loop start' }).fill('0.5');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit Barbell hip thrust' })).toContainText('✂');

  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Edit Bench press' }).click();
  await page.getByRole('button', { name: 'Delete clip' }).click();
  await expect(page.getByTestId('clip-thumb')).toHaveCount(1);
});

test('settings: add, rename and reorder groups', async ({ page }) => {
  await openLibrary(page);
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('textbox', { name: 'New group name' }).fill('Forearms');
  await page.getByRole('button', { name: 'Add group' }).click();
  await expect(page.getByRole('textbox', { name: 'Rename Forearms' })).toBeVisible();
  await page.getByRole('button', { name: 'Move Forearms up' }).click();
  const names = await page.locator('.group-list input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(names.slice(-2)).toEqual(['Forearms', 'Cardio / Full body']);
});
