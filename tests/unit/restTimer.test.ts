import { describe, expect, it } from 'vitest';
import {
  extendRest,
  formatRemaining,
  isWorkoutStale,
  restState,
  shouldVibrate,
  startRest,
  WORKOUT_MAX_AGE_MS,
} from '../../src/lib/restTimer';

const T0 = 1_700_000_000_000;

describe('restState', () => {
  it('is idle without an end time', () => {
    expect(restState(undefined, T0)).toEqual({ kind: 'idle' });
  });

  it('counts down from the stored end timestamp (no drift)', () => {
    const endsAt = startRest(T0, 90);
    expect(restState(endsAt, T0 + 18_000)).toEqual({ kind: 'running', endsAt, remainingMs: 72_000 });
  });

  it('is over at and after the end time', () => {
    const endsAt = startRest(T0, 60);
    expect(restState(endsAt, endsAt).kind).toBe('over');
    expect(restState(endsAt, endsAt + 5_000).kind).toBe('over');
  });
});

describe('Set done / +15s', () => {
  it('Set done in any state restarts a full countdown', () => {
    const first = startRest(T0, 90);
    const restarted = startRest(T0 + 30_000, 90);
    expect(restarted - (T0 + 30_000)).toBe(90_000);
    expect(restarted).toBeGreaterThan(first - 1);
  });

  it('+15s extends only the current running rest', () => {
    const endsAt = startRest(T0, 90);
    expect(extendRest(endsAt, T0 + 10_000)).toBe(endsAt + 15_000);
  });

  it('+15s after rest is over counts from now', () => {
    const endsAt = startRest(T0, 60);
    const now = endsAt + 20_000;
    expect(extendRest(endsAt, now)).toBe(now + 15_000);
    expect(extendRest(undefined, now)).toBe(now + 15_000);
  });
});

describe('shouldVibrate', () => {
  it('vibrates only when this page saw the rest running and it crossed zero', () => {
    expect(shouldVibrate('running', 'over')).toBe(true);
    expect(shouldVibrate(undefined, 'over')).toBe(false); // resumed after end
    expect(shouldVibrate('over', 'over')).toBe(false);
    expect(shouldVibrate('idle', 'running')).toBe(false);
  });
});

describe('formatRemaining', () => {
  it('formats m:ss and rounds up partial seconds', () => {
    expect(formatRemaining(72_000)).toBe('1:12');
    expect(formatRemaining(500)).toBe('0:01');
    expect(formatRemaining(0)).toBe('0:00');
    expect(formatRemaining(-5)).toBe('0:00');
  });
});

describe('isWorkoutStale', () => {
  it('resumes a workout under 3 hours old and drops an older one', () => {
    expect(isWorkoutStale(T0, T0 + WORKOUT_MAX_AGE_MS - 1)).toBe(false);
    expect(isWorkoutStale(T0, T0 + WORKOUT_MAX_AGE_MS)).toBe(true);
  });
});
