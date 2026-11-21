import { expect, type Page } from '@playwright/test';
import { fileURLToPath } from 'node:url';

export const fixture = (name: string) => fileURLToPath(new URL(`../fixtures/${name}`, import.meta.url));

export interface ClipSpec {
  file: string;
  name: string;
  main: string;
  extra?: string[];
}

// Starter group order: Chest, Back, Shoulders, Biceps, Triceps, Quads, Hamstrings,
// Glutes, Calves, Core, Cardio / Full body.
export const SQUAT: ClipSpec = { file: 'goblet-squat.webm', name: 'Goblet squat', main: 'Quads', extra: ['Glutes'] };
export const THRUST: ClipSpec = { file: 'hip-thrust.webm', name: 'Hip thrust', main: 'Glutes' };
export const BENCH: ClipSpec = { file: 'bench-press.webm', name: 'Bench press', main: 'Chest' };

export async function openLibrary(page: Page) {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
}

export async function importClips(page: Page, clips: ClipSpec[]) {
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByTestId('pick-videos').setInputFiles(clips.map((c) => fixture(c.file)));
  for (const clip of clips) {
    const name = page.getByRole('textbox', { name: 'Name' });
    await expect(name).toBeVisible();
    await name.fill(clip.name);
    await page.getByRole('radiogroup', { name: 'Main group' }).getByRole('radio', { name: clip.main, exact: true }).click();
    for (const extra of clip.extra ?? []) {
      await page.getByRole('group', { name: 'Also works' }).getByRole('checkbox', { name: extra, exact: true }).click();
    }
    await page.getByRole('button', { name: 'Save & next' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Gym tutorials' })).toBeVisible();
}

export async function startWorkout(page: Page, groups: string[]) {
  await page.getByRole('button', { name: /Start workout/ }).click();
  const picker = page.getByRole('group', { name: "Today's groups" });
  for (const g of groups) await picker.getByRole('checkbox', { name: new RegExp(`^${g} \\d+$`) }).click();
  await page.getByRole('button', { name: '▶ Start' }).click();
  await expect(page.getByTestId('deck')).toBeVisible();
}

export async function swipeUp(page: Page) {
  await page.getByTestId('deck').evaluate((el) => el.scrollBy(0, el.clientHeight));
}
