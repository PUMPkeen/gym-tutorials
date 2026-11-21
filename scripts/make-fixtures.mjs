// Generates short WebM (VP8) test clips with the test browser's MediaRecorder, so the
// E2E suite needs no binary assets, no ffmpeg and no H.264 support.
// Usage: npm run fixtures
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../tests/fixtures/', import.meta.url));
await mkdir(outDir, { recursive: true });

const clips = [
  { file: 'goblet-squat.webm', label: 'SQUAT', color: '#2f9e44', ms: 2000 },
  { file: 'hip-thrust.webm', label: 'THRUST', color: '#1c7ed6', ms: 2600 },
  { file: 'bench-press.webm', label: 'BENCH', color: '#e8590c', ms: 1600 },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<html><body></body></html>');
  for (const clip of clips) {
    const base64 = await page.evaluate(async ({ label, color, ms }) => {
      const canvas = document.createElement('canvas');
      canvas.width = 360;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
      const chunks = [];
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const done = new Promise((r) => (rec.onstop = r));
      const t0 = performance.now();
      let raf = 0;
      const draw = () => {
        const t = (performance.now() - t0) / 1000;
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 360, 640);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 48px sans-serif';
        ctx.fillText(label, 40, 120);
        ctx.fillRect(40, 300 + Math.sin(t * 6) * 120, 280, 40); // a moving "bar"
        raf = requestAnimationFrame(draw);
      };
      draw();
      rec.start(100);
      await new Promise((r) => setTimeout(r, ms));
      rec.stop();
      await done;
      cancelAnimationFrame(raf);
      const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer();
      let bin = '';
      new Uint8Array(buf).forEach((b) => (bin += String.fromCharCode(b)));
      return btoa(bin);
    }, clip);
    await writeFile(outDir + clip.file, Buffer.from(base64, 'base64'));
    console.log(`tests/fixtures/${clip.file}`);
  }
} finally {
  await browser.close();
}

// Not a video at all: must be rejected by the playability check.
await writeFile(outDir + 'broken.webm', Buffer.from('this is not a video file '.repeat(200)));
console.log('tests/fixtures/broken.webm');
