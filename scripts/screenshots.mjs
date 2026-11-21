// Takes phone-size screenshots of the main screens using the generated test clips.
// Needs the preview server running: npm run build && npm run preview
// Usage: node scripts/screenshots.mjs
import { chromium, devices } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
const fx = (f) => fileURLToPath(new URL(`../tests/fixtures/${f}`, import.meta.url));
await mkdir(out, { recursive: true });

const clips = [
  ['goblet-squat.webm', 'Goblet squat', 'Quads', ['Glutes']],
  ['hip-thrust.webm', 'Hip thrust', 'Glutes', []],
  ['bench-press.webm', 'Bench press', 'Chest', []],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['Pixel 7'], colorScheme: 'dark' });
const page = await ctx.newPage();
try {
  await page.goto('http://localhost:4173/');
  await page.getByRole('button', { name: '+ Add' }).click();
  await page.getByTestId('pick-videos').setInputFiles(clips.map(([f]) => fx(f)));
  for (const [, name, main, extra] of clips) {
    await page.getByRole('textbox', { name: 'Name' }).fill(name);
    await page.getByRole('radiogroup', { name: 'Main group' }).getByRole('radio', { name: main, exact: true }).click();
    for (const e of extra) await page.getByRole('group', { name: 'Also works' }).getByRole('checkbox', { name: e, exact: true }).click();
    if (name === 'Hip thrust') {
      await page.getByText('Loop only the movement').click();
      await page.getByRole('slider', { name: 'Loop start' }).fill('0.4');
      await page.screenshot({ path: out + '2-add-clip.png' });
    }
    await page.getByRole('button', { name: 'Save & next' }).click();
  }
  await page.getByRole('heading', { name: 'Gym tutorials' }).waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '1-library.png' });

  await page.getByRole('button', { name: /Start workout/ }).click();
  for (const g of ['Quads', 'Glutes']) await page.getByRole('checkbox', { name: new RegExp(`^${g} \\d+$`) }).click();
  await page.screenshot({ path: out + '3-pick-groups.png' });
  await page.getByRole('button', { name: '▶ Start' }).click();
  await page.getByRole('button', { name: 'Set done → start rest' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: out + '4-workout-deck.png' });
  console.log('docs/screenshots/1-4 written');
} finally {
  await browser.close();
}
