import { devices, expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { BENCH, fixture, importClips, openLibrary, SQUAT, startWorkout, THRUST } from './helpers';

test('offline cold start: the app and its videos work with no network', async ({ page, context }) => {
  await openLibrary(page);
  await importClips(page, [THRUST]);
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload(); // now controlled by the service worker

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit Hip thrust' })).toBeVisible();
  await startWorkout(page, ['Glutes']);
  const video = page.getByTestId('deck').locator('video').first();
  await expect
    .poll(() => video.evaluate((v) => (v as HTMLVideoElement).readyState))
    .toBeGreaterThanOrEqual(2);
});

test('backup: export, wipe, restore in two rounds keeps names, groups, trims and rest', async ({ page, browser }) => {
  await openLibrary(page);
  await importClips(page, [SQUAT, THRUST, BENCH]);

  // Customise things the backup must carry: a renamed group, a trim, a rest time.
  await page.getByRole('button', { name: 'Settings' }).click();
  const glutes = page.getByRole('textbox', { name: 'Rename Glutes' });
  await glutes.fill('Glutes & hips');
  await glutes.blur();
  await page.goBack();
  await page.getByRole('button', { name: 'Edit Hip thrust' }).click();
  await page.getByText('Loop only the movement').click();
  await page.getByRole('slider', { name: 'Loop start' }).fill('0.5');
  await page.getByRole('spinbutton', { name: 'Rest seconds' }).fill('120');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await page.getByRole('button', { name: 'Settings' }).click();
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export backup' }).click(),
  ]);
  const manifestPath = await download.path();
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  expect(manifest.clips).toHaveLength(3);
  expect(JSON.stringify(manifest)).not.toContain('"video"');

  // A wiped phone: fresh browser profile, empty storage.
  const fresh = await browser.newContext({ ...devices['Pixel 7'], baseURL: 'http://localhost:4173/' });
  const p2 = await fresh.newPage();
  await openLibrary(p2);
  await p2.getByRole('button', { name: 'Restore from backup' }).click();
  await p2.getByTestId('restore-manifest').setInputFiles(manifestPath);
  await expect(p2.getByTestId('restore-progress')).toContainText('Restored 0 of 3');

  await p2.getByTestId('restore-videos').setInputFiles([fixture(THRUST.file)]);
  await expect(p2.getByTestId('restore-progress')).toContainText('Restored 1 of 3');
  await p2.getByTestId('restore-videos').setInputFiles([fixture(SQUAT.file), fixture(BENCH.file)]);

  await expect(p2.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
  await expect(p2.getByTestId('clip-thumb')).toHaveCount(3);
  await expect(p2.getByRole('button', { name: 'Edit Hip thrust' })).toContainText('✂');
  await expect(p2.getByRole('button', { name: 'Glutes & hips 2' })).toBeVisible();
  await p2.getByRole('button', { name: 'Edit Hip thrust' }).click();
  await expect(p2.getByRole('spinbutton', { name: 'Rest seconds' })).toHaveValue('120');
  await fresh.close();
});
