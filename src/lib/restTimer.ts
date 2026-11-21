// Rest timer rules (design doc: Workout deck, "Rest timer").
//
//   idle ──Set done──> running(endsAt = now + restSec)
//   running ──+15s──> running(endsAt + 15s)      (current rest only; restSec unchanged)
//   running ──Set done──> running(now + restSec) (restart)
//   running ──now >= endsAt──> over   (vibrate ONLY if this page saw it running)
//   over ──tap overlay──> idle        (clears restEndsAt)
//   over ──Set done──> running        (dismiss + start a new rest)
//
// The countdown is always computed from the stored restEndsAt timestamp, never by
// counting ticks, so it cannot drift and survives a reload or page discard.

export type RestState =
  | { kind: 'idle' }
  | { kind: 'running'; endsAt: number; remainingMs: number }
  | { kind: 'over'; endsAt: number };

export const EXTEND_SEC = 15;
export const WORKOUT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

export function restState(restEndsAt: number | undefined, now: number): RestState {
  if (restEndsAt === undefined) return { kind: 'idle' };
  if (now < restEndsAt) return { kind: 'running', endsAt: restEndsAt, remainingMs: restEndsAt - now };
  return { kind: 'over', endsAt: restEndsAt };
}

/** "Set done" in any state starts a fresh countdown of this clip's restSec. */
export function startRest(now: number, restSec: number): number {
  return now + restSec * 1000;
}

/** "+15s" extends the running rest; if rest is already over it restarts from now. */
export function extendRest(restEndsAt: number | undefined, now: number, sec = EXTEND_SEC): number {
  const base = restEndsAt !== undefined && restEndsAt > now ? restEndsAt : now;
  return base + sec * 1000;
}

/**
 * Vibrate only when the countdown crosses zero while this page was watching it run.
 * On resume with restEndsAt already in the past, the overlay shows "Rest over" silently.
 */
export function shouldVibrate(prev: RestState['kind'] | undefined, next: RestState['kind']): boolean {
  return prev === 'running' && next === 'over';
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** A workout untouched for 3 hours is not resumed on launch. */
export function isWorkoutStale(updatedAt: number, now: number, maxAgeMs = WORKOUT_MAX_AGE_MS): boolean {
  return now - updatedAt >= maxAgeMs;
}
