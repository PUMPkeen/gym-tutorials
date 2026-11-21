# TODOS

## Workout deck

### Mirror + 0.5x slow-mo playback

**What:** Add a mirror toggle (flip the video horizontally) and a 0.5x speed toggle to the Workout deck.

**Why:** Mirroring makes the clip match what you see in the gym mirror. Slow-mo lets you see the hard part of a movement.

**Context:** Offered in office hours (D4, 2026-11-21); you deferred it to the "later" list. Both are cheap: CSS `transform: scaleX(-1)` and `video.playbackRate = 0.5`. Add after v1 has had a few weeks of real gym use. Design: docs/designs/gym-floor-deck.md.

**Effort:** S
**Priority:** P3
**Depends on:** v1 Workout deck (Next Steps 4)

### Form cue + last weight per clip

**What:** One line of your own form cue shown over the clip, plus the weight/reps you used last time.

**Why:** Turns the library into a light training log, so you don't need a separate notes app in the gym.

**Context:** Offered in office hours (D4, 2026-11-21); you deferred it to the "later" list. It needs two new clip fields (`cue`, `lastWeight`), a field in Edit clip, and an editable overlay in the deck. The backup manifest schema would need a version bump.

**Effort:** M
**Priority:** P3
**Depends on:** v1 Edit clip and Workout deck

## Import

### Share from Gallery (Web Share Target)

**What:** Let you add a clip from the Android Gallery's Share menu straight into the app.

**Why:** Saves opening the app and the picker right after downloading a reel.

**Context:** Deferred in office hours (D8, 2026-11-21) after the second opinion pointed out that Instagram and TikTok share a link, not the file. Only Gallery/Files shares carry the video. First run a 10-minute stub test: a `share_target` with POST multipart accepting `video/*`, installed on the phone; log what the service worker receives from Gallery and from each social app. Build only if the Gallery share delivers a File.

**Effort:** S (stub) + M (feature)
**Priority:** P4
**Depends on:** v1 installed on the phone
