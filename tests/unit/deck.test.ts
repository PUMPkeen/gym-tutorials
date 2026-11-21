import { describe, expect, it } from 'vitest';
import { buildDeck, clipsInGroup, countByGroup } from '../../src/lib/deck';
import type { Group } from '../../src/db';

const groups: Group[] = [
  { id: 'chest', name: 'Chest', order: 0 },
  { id: 'quads', name: 'Quads', order: 1 },
  { id: 'glutes', name: 'Glutes', order: 2 },
  { id: 'core', name: 'Core', order: 3 },
];

const clip = (id: string, mainGroupId: string, extraGroupIds: string[], order: number) => ({
  id,
  mainGroupId,
  extraGroupIds,
  order,
});

const clips = [
  clip('bss', 'glutes', ['quads'], 1), // Bulgarian split squat
  clip('squat', 'quads', ['glutes', 'core'], 0),
  clip('thrust', 'glutes', [], 2),
  clip('bench', 'chest', [], 3),
  clip('plank', 'core', [], 4),
];

describe('buildDeck', () => {
  it('shows a clip in two ticked groups only once, under its main group', () => {
    const deck = buildDeck(['glutes', 'quads'], groups, clips);
    expect(deck.filter((d) => d.clipId === 'bss')).toEqual([{ clipId: 'bss', groupId: 'glutes' }]);
    expect(deck.filter((d) => d.clipId === 'squat')).toEqual([{ clipId: 'squat', groupId: 'quads' }]);
  });

  it('orders by group order, then clip order, regardless of tick order', () => {
    const deck = buildDeck(['glutes', 'quads'], groups, clips);
    expect(deck.map((d) => d.clipId)).toEqual(['squat', 'bss', 'thrust']);
  });

  it('places a clip under its first ticked extra group when its main group is not ticked', () => {
    // squat: main quads (not ticked), extras glutes + core (both ticked) -> glutes (lower order)
    const deck = buildDeck(['core', 'glutes'], groups, clips);
    expect(deck).toEqual([
      { clipId: 'squat', groupId: 'glutes' },
      { clipId: 'bss', groupId: 'glutes' },
      { clipId: 'thrust', groupId: 'glutes' },
      { clipId: 'plank', groupId: 'core' },
    ]);
  });

  it('returns an empty deck when the ticked groups hold no clips', () => {
    expect(buildDeck(['chest'], groups, [])).toEqual([]);
    expect(buildDeck([], groups, clips)).toEqual([]);
  });

  it('ignores ticked ids that are not real groups', () => {
    expect(buildDeck(['nope'], groups, clips)).toEqual([]);
  });
});

describe('clipsInGroup / countByGroup', () => {
  it('counts main and extra membership for the Library chips', () => {
    expect(clipsInGroup('quads', clips).map((c) => c.id).sort()).toEqual(['bss', 'squat']);
    const counts = countByGroup(groups, clips);
    expect(counts.get('glutes')).toBe(3);
    expect(counts.get('core')).toBe(2);
    expect(counts.get('chest')).toBe(1);
  });
});
