# Gym Tutorials

A private, offline library of short exercise videos for your Android phone. You
group clips by muscle and swipe through only today's exercises in the gym, each
clip looping with a rest timer on top. Videos stay on the phone, and the app
works without signal.

**Live app:** https://pumpkeen.github.io/gym-tutorials/. On Android, open it in Chrome, then use **⋮ → Install app**.
Every push to `main` runs the unit and E2E tests, then deploys to GitHub Pages.

Design and decisions: [docs/designs/gym-floor-deck.md](docs/designs/gym-floor-deck.md).

## Develop

```powershell
npm install
npm run dev          # http://localhost:5173
```

## Test

```powershell
npm test             # unit tests (Vitest)
npx playwright install chromium   # once
npm run test:e2e     # end-to-end on an emulated Pixel 7, against the production build
```

Test clips are generated rather than stored as large binaries. Run `npm run fixtures` to regenerate them.
Some checks need a real phone (vibration, wake lock, airplane mode); see [docs/device-checklist.md](docs/device-checklist.md).

## Deploy

```powershell
npm run build        # outputs dist/
```

Host `dist/` on any static HTTPS host, for example Cloudflare Pages or GitHub Pages. The build uses relative
paths, so it also works from a subfolder. Open the URL in Chrome on the phone and choose
**Install app**. After that the app runs offline.

Your videos never leave the phone. To back up, use **Settings → Export backup** and keep your original videos in the gallery.
