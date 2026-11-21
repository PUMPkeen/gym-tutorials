// Renders public/icon.svg to the PNG sizes the web app manifest needs.
// Usage: npm run icons
import { chromium } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url), 'utf8');
const browser = await chromium.launch();
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<html><body style="margin:0;background:#0f1115">${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`,
    );
    await page.screenshot({ path: fileURLToPath(new URL(`../public/icon-${size}.png`, import.meta.url)) });
    await page.close();
    console.log(`public/icon-${size}.png`);
  }
} finally {
  await browser.close();
}
