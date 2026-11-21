import { describe, expect, it } from 'vitest';
import {
  buildManifest,
  findDuplicate,
  ManifestError,
  matchFile,
  parseManifest,
  unmatchedEntries,
} from '../../src/lib/backup';
import type { ClipMeta, Group } from '../../src/db';

const groups: Group[] = [
  { id: 'g2', name: 'Quads (legs)', order: 1 },
  { id: 'g1', name: 'Glutes', order: 0 },
];

const meta = (over: Partial<ClipMeta>): ClipMeta => ({
  id: 'c1',
  name: 'Hip thrust',
  mainGroupId: 'g1',
  extraGroupIds: [],
  order: 0,
  createdAt: 1,
  mime: 'video/mp4',
  durationSec: 41.2,
  sizeBytes: 1000,
  restSec: 90,
  sourceFileName: 'hip.mp4',
  ...over,
});

const clips = [
  meta({ id: 'a', order: 1, sizeBytes: 500, durationSec: 30, sourceFileName: 'a.mp4', loopStart: 2, loopEnd: 6.5, restSec: 120 }),
  meta({ id: 'b', order: 0, sizeBytes: 800, durationSec: 58, sourceFileName: 'b.mp4', extraGroupIds: ['g2'] }),
];

describe('buildManifest / parseManifest', () => {
  it('round-trips groups, settings and clip metadata (no video bytes)', () => {
    const m = buildManifest(groups, { defaultRestSec: 75 }, clips, new Date('2026-11-21T10:00:00Z'));
    const back = parseManifest(JSON.stringify(m));
    expect(back.version).toBe(1);
    expect(back.groups.map((g) => g.name)).toEqual(['Glutes', 'Quads (legs)']);
    expect(back.settings).toEqual({ defaultRestSec: 75 });
    expect(back.clips.map((c) => c.id)).toEqual(['b', 'a']);
    expect(back.clips[1]).toMatchObject({ loopStart: 2, loopEnd: 6.5, restSec: 120, sizeBytes: 500 });
    expect(JSON.stringify(back)).not.toContain('video');
  });

  it('rejects non-JSON and foreign JSON with a readable error', () => {
    expect(() => parseManifest('not json')).toThrow(ManifestError);
    expect(() => parseManifest('{"hello":1}')).toThrow(/not a Gym Tutorials backup/);
    expect(() =>
      parseManifest(JSON.stringify({ version: 1, groups: [], settings: {}, clips: [{ id: 'x' }] })),
    ).toThrow(/damaged/);
  });
});

describe('matchFile', () => {
  const m = buildManifest(groups, { defaultRestSec: 90 }, clips);

  it('matches on size + duration even when the picker renamed the file', () => {
    expect(matchFile({ name: '1000001234.mp4', sizeBytes: 800, durationSec: 58.05 }, m.clips, [])?.id).toBe('b');
  });

  it('does not match when duration differs by more than 0.1 s', () => {
    expect(matchFile({ name: 'b.mp4', sizeBytes: 800, durationSec: 58.2 }, m.clips, [])).toBeUndefined();
  });

  it('skips entries already restored', () => {
    expect(matchFile({ name: 'b.mp4', sizeBytes: 800, durationSec: 58 }, m.clips, ['b'])).toBeUndefined();
  });

  it('uses the file name only as a tie-breaker between identical media', () => {
    const twins = [
      { ...m.clips[0], id: 't1', sizeBytes: 9, durationSec: 5, sourceFileName: 'one.mp4' },
      { ...m.clips[0], id: 't2', sizeBytes: 9, durationSec: 5, sourceFileName: 'two.mp4' },
    ];
    expect(matchFile({ name: 'two.mp4', sizeBytes: 9, durationSec: 5 }, twins, [])?.id).toBe('t2');
    expect(matchFile({ name: 'other.mp4', sizeBytes: 9, durationSec: 5 }, twins, [])?.id).toBe('t1');
  });

  it('lists what is still unmatched', () => {
    expect(unmatchedEntries(m, ['a']).map((c) => c.id)).toEqual(['b']);
  });
});

describe('findDuplicate', () => {
  it('flags a clip with the same size and duration', () => {
    expect(findDuplicate({ name: 'x.mp4', sizeBytes: 500, durationSec: 30.05 }, clips)?.id).toBe('a');
    expect(findDuplicate({ name: 'x.mp4', sizeBytes: 501, durationSec: 30 }, clips)).toBeUndefined();
  });
});
