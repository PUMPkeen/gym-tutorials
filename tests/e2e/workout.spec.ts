import { expect, test } from '@playwright/test';
import { BENCH, importClips, openLibrary, SQUAT, startWorkout, swipeUp, THRUST } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await openLibrary(page);
  await importClips(page, [SQUAT, THRUST, BENCH]);
});

test('deck: only today’s groups, each clip once, group order then clip order', async ({ page }) => {
  await startWorkout(page, ['Glutes', 'Quads']);
  // Squat is in Quads (main) and Glutes (extra) but appears once, under Quads.
  await expect(page.getByTestId('deck-position')).toHaveText('Quads · 1 / 2');
  await expect(page.getByTestId('clip-name')).toHaveText('Goblet squat');
  await swipeUp(page);
  await expect(page.getByTestId('deck-position')).toHaveText('Glutes · 2 / 2');
  await expect(page.getByTestId('clip-name')).toHaveText('Hip thrust');
  await page.getByRole('button', { name: '✕ End' }).click();
  await expect(page.getByRole('button', { name: /Start workout/ })).toBeVisible();
});

test('picker: start is disabled when ticked groups hold no clips', async ({ page }) => {
  await page.getByRole('button', { name: /Start workout/ }).click();
  await page.getByRole('checkbox', { name: /^Calves 0$/ }).click();
  await expect(page.getByTestId('deck-count')).toHaveText('0 exercises');
  await expect(page.getByRole('button', { name: '▶ Start' })).toBeDisabled();
});

test('rest timer: Set done, +15s, Rest over, dismiss, restart', async ({ page }) => {
  await startWorkout(page, ['Chest']);
  await page.getByRole('button', { name: 'Set done → start rest' }).click();
  await expect(page.getByTestId('rest-remaining')).toHaveText(/1:(30|29)/);
  await page.getByRole('button', { name: '+15s' }).click();
  await expect(page.getByTestId('rest-remaining')).toHaveText(/1:(45|44)/);

  // The overlay stays while swiping (single-clip deck: swipe is a no-op).
  await page.clock.fastForward('01:50');
  await expect(page.getByTestId('rest-over')).toBeVisible();
  await page.getByTestId('rest-over').click();
  await expect(page.getByTestId('rest-over')).toHaveCount(0);

  await page.getByRole('button', { name: 'Set done → start rest' }).click();
  await page.clock.fastForward('01:31');
  await expect(page.getByTestId('rest-over')).toBeVisible();
  // Set done while "Rest over" shows starts a new rest straight away.
  await page.getByRole('button', { name: 'Set done → start rest' }).click();
  await expect(page.getByTestId('rest-remaining')).toBeVisible();
});

test('resume: a reload mid-rest reopens the deck at the same clip, timer still running', async ({ page }) => {
  await startWorkout(page, ['Glutes', 'Quads']);
  await swipeUp(page);
  await expect(page.getByTestId('deck-position')).toHaveText('Glutes · 2 / 2');
  await page.getByRole('button', { name: 'Set done → start rest' }).click();
  await page.clock.fastForward('00:20');
  await page.reload();
  await expect(page.getByTestId('deck-position')).toHaveText('Glutes · 2 / 2');
  await expect(page.getByTestId('rest-remaining')).toHaveText(/1:(10|09)/);
});

test('resume: a workout older than 3 hours is not resumed', async ({ page }) => {
  await startWorkout(page, ['Chest']);
  await page.clock.fastForward('03:00:01');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
  await expect(page.getByText('Workout in progress')).toHaveCount(0);
});
