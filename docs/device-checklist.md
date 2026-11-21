# On-device checklist (Android phone, Chrome)

These checks need a real phone; the automated tests can't cover them (eng review R2).
Run the whole list **before adding trims/timer to your routine** and **before calling v1 done**.

Setup: open the deployed URL in Chrome on the phone, then use **⋮ → Install app** (or "Add to Home screen"). Launch it from the home-screen icon, not from a Chrome tab.

| # | Check | How | Pass when |
|---|---|---|---|
| 1 | Install | Install from Chrome, open from the icon | Opens full-screen with no Chrome address bar |
| 2 | Real reels import | Add 5 clips you downloaded from Instagram/TikTok | All 5 import with a thumbnail; nothing is wrongly refused |
| 3 | HEVC / odd files | Add a video recorded with the phone camera in "high efficiency" (HEVC) mode, if your phone has it | Either it plays, or it's refused with a clear message. Never a black tile |
| 4 | Storage protection | Settings → Storage | Says "Protected". If not, tap "Ask Chrome to keep videos" and check again |
| 5 | Airplane-mode cold start (go/no-go) | Import 30+ real clips. Swipe the app away from recents, turn on airplane mode, launch from the icon | Library loads; Start workout works; every clip in the deck plays |
| 6 | Wake lock | Start a workout and leave the phone untouched for longer than your screen timeout | Screen stays on in the deck |
| 7 | Vibration | Set done, wait for the rest to end, with the app open | Phone buzzes at zero and shows "Rest over" |
| 8 | Loop seam | Trim a clip to one rep, watch 5 loops in the deck | Any hitch at the loop point is small enough to ignore |
| 9 | Back gesture | In the deck, swipe back from the screen edge | Lands on the Library with "Workout in progress · Resume"; Resume returns to the same clip |
| 10 | Page discard | Mid-rest, open several heavy apps (camera, maps), then return | Same clip, timer still correct |
| 11 | Backup | Settings → Export backup; confirm the file appears in Downloads | File saved (keep it with your gallery originals) |

Note: after Android has fully reloaded the app mid-rest, Chrome blocks vibration until your next tap. The "Rest over" overlay still shows. This is expected.

Record results (date, phone model, pass/fail per row) at the bottom of this file.
