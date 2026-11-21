import type { ClipMeta, Group } from '../db';

// Deck composition (design doc: Workout deck, "Deck contents and order").
//
//   ticked groups, in group order:   [Glutes, Quads]
//   each clip appears ONCE:
//     1. under the first ticked group that is its MAIN group
//     2. otherwise under its first ticked EXTRA group (in group order)
//     3. otherwise not in the deck
//   within a group: by clip.order
//
//   Bulgarian split squat (main Glutes, extra Quads) -> once, under Glutes.

export interface DeckItem {
  clipId: string;
  groupId: string;
}

type DeckClip = Pick<ClipMeta, 'id' | 'mainGroupId' | 'extraGroupIds' | 'order'>;

export function buildDeck(tickedGroupIds: string[], groups: Group[], clips: DeckClip[]): DeckItem[] {
  const ticked = new Set(tickedGroupIds);
  const tickedInOrder = [...groups].sort((a, b) => a.order - b.order).filter((g) => ticked.has(g.id));

  const placement = new Map<string, string>(); // clipId -> groupId
  for (const clip of clips) {
    if (ticked.has(clip.mainGroupId)) {
      placement.set(clip.id, clip.mainGroupId);
      continue;
    }
    const extra = tickedInOrder.find((g) => clip.extraGroupIds.includes(g.id));
    if (extra) placement.set(clip.id, extra.id);
  }

  const sortedClips = [...clips].sort((a, b) => a.order - b.order);
  const deck: DeckItem[] = [];
  for (const group of tickedInOrder) {
    for (const clip of sortedClips) {
      if (placement.get(clip.id) === group.id) deck.push({ clipId: clip.id, groupId: group.id });
    }
  }
  return deck;
}

/** Clips listed under a group in the Library: main group or any extra group. */
export function clipsInGroup<T extends DeckClip>(groupId: string, clips: T[]): T[] {
  return clips.filter((c) => c.mainGroupId === groupId || c.extraGroupIds.includes(groupId));
}

export function countByGroup(groups: Group[], clips: DeckClip[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const g of groups) counts.set(g.id, clipsInGroup(g.id, clips).length);
  return counts;
}
