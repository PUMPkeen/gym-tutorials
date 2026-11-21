import { describe, expect, it } from 'vitest';
import { assessProbe, isQuotaError, thumbSeekTime } from '../../src/lib/importVideo';
import { hasTrim, loopSeekTarget } from '../../src/lib/loop';

describe('assessProbe (playability rule)', () => {
  it('accepts a clip with length, picture and a drawn frame', () => {
    expect(assessProbe({ durationSec: 42, videoWidth: 720, thumbBytes: 9000 })).toBeNull();
  });

  it('rejects a clip whose picture cannot be decoded (videoWidth 0)', () => {
    expect(assessProbe({ durationSec: 42, videoWidth: 0, thumbBytes: 0 })).toMatch(/cannot decode/);
  });

  it('rejects missing length or an empty frame', () => {
    expect(assessProbe({ durationSec: Infinity, videoWidth: 720, thumbBytes: 10 })).toMatch(/length/);
    expect(assessProbe({ durationSec: 0, videoWidth: 720, thumbBytes: 10 })).toMatch(/length/);
    expect(assessProbe({ durationSec: 5, videoWidth: 720, thumbBytes: 0 })).toMatch(/frame/);
  });
});

describe('thumbSeekTime', () => {
  it('uses 1 s in, or the middle of very short clips', () => {
    expect(thumbSeekTime(60)).toBe(1);
    expect(thumbSeekTime(1.2)).toBeCloseTo(0.6);
  });
});

describe('isQuotaError', () => {
  it('recognises a raw and a Dexie-wrapped QuotaExceededError', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true);
    expect(isQuotaError({ name: 'AbortError', inner: { name: 'QuotaExceededError' } })).toBe(true);
    expect(isQuotaError(new Error('x'))).toBe(false);
    expect(isQuotaError(null)).toBe(false);
  });
});

describe('loopSeekTarget', () => {
  it('jumps back to loopStart at or after loopEnd', () => {
    expect(loopSeekTarget(6.5, 2, 6.5)).toBe(2);
    expect(loopSeekTarget(7, 2, 6.5)).toBe(2);
  });

  it('keeps playing inside the loop', () => {
    expect(loopSeekTarget(4, 2, 6.5)).toBeNull();
  });

  it('pulls playback forward when it sits before the loop', () => {
    expect(loopSeekTarget(0, 2, 6.5)).toBe(2);
  });

  it('does nothing for untrimmed or invalid trims', () => {
    expect(loopSeekTarget(10)).toBeNull();
    expect(loopSeekTarget(10, 5, 5)).toBeNull();
    expect(hasTrim({ loopStart: 1, loopEnd: 3 })).toBe(true);
    expect(hasTrim({ loopStart: 3, loopEnd: 1 })).toBe(false);
  });
});
