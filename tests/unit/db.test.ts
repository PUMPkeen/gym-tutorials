import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { GymDB, getSettings, nextClipOrder, STARTER_GROUPS, toMeta, type Clip } from '../../src/db';

let n = 0;
const dbs: GymDB[] = [];
function freshDb() {
  const d = new GymDB(`test-${Date.now()}-${n++}`);
  dbs.push(d);
  return d;
}
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fakeClip(over: Partial<Clip>): Clip {
  return {
    id: crypto.randomUUID(),
    name: 'Clip',
    mainGroupId: 'g',
    extraGroupIds: [],
    order: 0,
    createdAt: 0,
    mime: 'video/webm',
    durationSec: 3,
    sizeBytes: 10,
    restSec: 90,
    sourceFileName: 'c.webm',
    video: new Blob(['v']),
    thumb: new Blob(['t']),
    ...over,
  };
}

describe('GymDB', () => {
  it('seeds the starter groups in order with UUID ids, and default settings', async () => {
    const d = freshDb();
    const groups = await d.groups.orderBy('order').toArray();
    expect(groups.map((g) => g.name)).toEqual(STARTER_GROUPS);
    expect(groups.every((g) => UUID.test(g.id))).toBe(true);
    const s = await getSettings(d);
    expect(s.defaultRestSec).toBe(90);
    expect(s.lastWorkoutGroupIds).toEqual([]);
  });

  it('appends new clips at the end of the order', async () => {
    const d = freshDb();
    expect(await nextClipOrder(d)).toBe(0);
    await d.clips.add(fakeClip({ order: 0 }));
    await d.clips.add(fakeClip({ order: 5 }));
    expect(await nextClipOrder(d)).toBe(6);
  });

  it('finds clips by extra group through the multi-entry index', async () => {
    const d = freshDb();
    await d.clips.add(fakeClip({ id: 'x', mainGroupId: 'glutes', extraGroupIds: ['quads'] }));
    const viaExtra = await d.clips.where('extraGroupIds').equals('quads').toArray();
    expect(viaExtra.map((c) => c.id)).toEqual(['x']);
  });

  it('keeps a restored manifest id: put() never collides with UUIDs of new clips', async () => {
    const d = freshDb();
    await d.clips.add(fakeClip({ id: crypto.randomUUID() }));
    await d.clips.put(fakeClip({ id: 'restored-from-backup-id' }));
    expect(await d.clips.count()).toBe(2);
  });

  it('persists activeWorkout and pendingRestore as single rows', async () => {
    const d = freshDb();
    await d.activeWorkout.put({ id: 'active', groupIds: ['a'], deckIndex: 2, restEndsAt: 5, updatedAt: 1 });
    await d.activeWorkout.put({ id: 'active', groupIds: ['a'], deckIndex: 3, updatedAt: 2 });
    expect(await d.activeWorkout.count()).toBe(1);
    expect((await d.activeWorkout.get('active'))?.deckIndex).toBe(3);
  });

  it('toMeta strips the blobs', () => {
    const meta = toMeta(fakeClip({ id: 'm' }));
    expect('video' in meta).toBe(false);
    expect('thumb' in meta).toBe(false);
    expect(meta.id).toBe('m');
  });
});
