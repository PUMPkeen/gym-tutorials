import type { ClipMeta, Group, Manifest, ManifestClip } from '../db';

// Backup manifest + restore matching (design doc: Settings, Export/Restore).
//
//   export:  groups + settings + clip metadata  ->  JSON (no video bytes)
//   restore: manifest -> pendingRestore -> replace groups/settings
//            -> pick files (any number of rounds) -> match each file -> re-import
//
// Matching: size AND duration (within 0.1 s) first, file name only as tie-breaker.
// Android's Photo Picker can report different names than the Files picker.

export const DURATION_TOLERANCE_SEC = 0.1;

export function buildManifest(
  groups: Group[],
  settings: { defaultRestSec: number },
  clips: ClipMeta[],
  now = new Date(),
): Manifest {
  return {
    version: 1,
    exportedAt: now.toISOString(),
    groups: [...groups].sort((a, b) => a.order - b.order).map(({ id, name, order }) => ({ id, name, order })),
    settings: { defaultRestSec: settings.defaultRestSec },
    clips: [...clips]
      .sort((a, b) => a.order - b.order)
      .map((c) => ({
        id: c.id,
        name: c.name,
        mainGroupId: c.mainGroupId,
        extraGroupIds: [...c.extraGroupIds],
        order: c.order,
        loopStart: c.loopStart,
        loopEnd: c.loopEnd,
        restSec: c.restSec,
        sourceFileName: c.sourceFileName,
        sizeBytes: c.sizeBytes,
        durationSec: c.durationSec,
      })),
  };
}

export class ManifestError extends Error {}

export function parseManifest(text: string): Manifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ManifestError('This file is not a backup (not valid JSON).');
  }
  const m = raw as Partial<Manifest>;
  if (!m || m.version !== 1 || !Array.isArray(m.groups) || !Array.isArray(m.clips) || !m.settings) {
    throw new ManifestError('This file is not a Gym Tutorials backup.');
  }
  for (const c of m.clips) {
    if (typeof c.id !== 'string' || typeof c.sizeBytes !== 'number' || typeof c.durationSec !== 'number') {
      throw new ManifestError('The backup file is damaged (a clip entry is incomplete).');
    }
  }
  return m as Manifest;
}

export interface FileFacts {
  name: string;
  sizeBytes: number;
  durationSec: number;
}

function sameMedia(a: { sizeBytes: number; durationSec: number }, b: FileFacts): boolean {
  return a.sizeBytes === b.sizeBytes && Math.abs(a.durationSec - b.durationSec) <= DURATION_TOLERANCE_SEC;
}

/** Find the manifest entry a picked file belongs to, skipping entries already restored. */
export function matchFile(
  file: FileFacts,
  entries: ManifestClip[],
  matchedIds: Iterable<string>,
): ManifestClip | undefined {
  const done = new Set(matchedIds);
  const candidates = entries.filter((e) => !done.has(e.id) && sameMedia(e, file));
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((e) => e.sourceFileName === file.name) ?? candidates[0];
}

/** Duplicate warning on import: same size and duration as an existing clip. */
export function findDuplicate<T extends { sizeBytes: number; durationSec: number; sourceFileName: string }>(
  file: FileFacts,
  clips: T[],
): T | undefined {
  const candidates = clips.filter((c) => sameMedia(c, file));
  if (candidates.length <= 1) return candidates[0];
  return candidates.find((c) => c.sourceFileName === file.name) ?? candidates[0];
}

export function unmatchedEntries(manifest: Manifest, matchedIds: Iterable<string>): ManifestClip[] {
  const done = new Set(matchedIds);
  return manifest.clips.filter((c) => !done.has(c.id));
}
