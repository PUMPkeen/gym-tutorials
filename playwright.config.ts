import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build (vite preview) so the service worker and
// offline cache are real. Emulates an Android phone (Pixel 7, Chromium).
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  reporter: [['list']],
  use: {
    ...devices['Pixel 7'],
    baseURL: 'http://localhost:4173/',
    serviceWorkers: 'allow',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173/',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
