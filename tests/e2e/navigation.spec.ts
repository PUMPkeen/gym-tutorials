import { expect, test } from '@playwright/test';
import { importClips, openLibrary, startWorkout, swipeUp, SQUAT, THRUST } from './helpers';

// Eng review R1: the Android back gesture walks history; every screen is a hash route.

test('back from Settings, Add and Edit returns to the Library (Edit discards changes)', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [THRUST]);

  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();

  await page.getByRole('button', { name: '+ Add' }).click();
  await expect(page.getByRole('heading', { name: 'Add clips' })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();

  await page.getByRole('button', { name: 'Edit Hip thrust' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('Changed but not saved');
  await page.goBack();
  await expect(page.getByRole('button', { name: 'Edit Hip thrust' })).toBeVisible();
});

test('back from the deck keeps the workout and offers Resume at the same clip', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [SQUAT, THRUST]);
  await startWorkout(page, ['Quads', 'Glutes']);
  await swipeUp(page);
  await expect(page.getByTestId('deck-position')).toHaveText('Glutes · 2 / 2');

  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
  await page.getByRole('button', { name: /Workout in progress/ }).click();
  await expect(page.getByTestId('deck-position')).toHaveText('Glutes · 2 / 2');
});

test('launching into a resumed workout still has the Library underneath', async ({ page }) => {
  await openLibrary(page);
  await importClips(page, [THRUST]);
  await startWorkout(page, ['Glutes']);
  await page.goto('./'); // fresh launch while a workout is active
  await expect(page.getByTestId('deck')).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
});
