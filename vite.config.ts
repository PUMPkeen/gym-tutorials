import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Relative base so the build works at a domain root (Cloudflare Pages) and under a
// subpath (GitHub Pages, /gym-tutorials/) without changes. The service worker scope
// and manifest start_url follow the folder the app is served from.
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      // 'prompt' (eng review): a new version waits for "Update available" in
      // Settings and never reloads the page in the middle of a workout.
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Gym Tutorials',
        short_name: 'Gym',
        description: 'Offline exercise video library with a workout deck and rest timer.',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        background_color: '#0f1115',
        theme_color: '#0f1115',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
});
