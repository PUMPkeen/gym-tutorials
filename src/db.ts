import Dexie, { type Table } from 'dexie';

// Data model (design doc: "Data model (Dexie tables)").
//
//   groups ──< clips (mainGroupId, extraGroupIds[])      settings (1 row)
//   activeWorkout (0/1 row)   pendingRestore (0/1 row)
//
// Ids are UUID strings, never auto-increment, so a restore can keep the ids from
// a backup without colliding with clips added meanwhile (spec review R2).

export interface Group {
  id: string;
  name: string;
  order: number;
}

export interface ClipMeta {
  id: string;
  name: string;
  mainGroupId: string;
  extraGroupIds: string[];
  order: number;
  createdAt: number;
  mime: string;
  durationSec: number;
  sizeBytes: number;
  loopStart?: number;
  loopEnd?: number;
  restSec: number;
  sourceFileName: string;
}

export interface Clip extends ClipMeta {
  video: Blob;
  thumb: Blob;
}

export interface Settings {
  id: 'settings';
  defaultRestSec: number;
  lastWorkoutGroupIds: string[];
  persistGranted?: boolean;
}

export interface ActiveWorkout {
  id: 'active';
  groupIds: string[];
  deckIndex: number;
  restEndsAt?: number;
  updatedAt: number;
}

export interface ManifestClip {
  id: string;
  name: string;
  mainGroupId: string;
  extraGroupIds: string[];
  order: number;
  loopStart?: number;
  loopEnd?: number;
  restSec: number;
  sourceFileName: string;
  sizeBytes: number;
  durationSec: number;
}

export interface Manifest {
  version: 1;
  exportedAt: string;
  groups: Group[];
  settings: { defaultRestSec: number };
  clips: ManifestClip[];
}

export interface PendingRestore {
  id: 'pending';
  manifest: Manifest;
  matchedIds: string[];
}

export const DEFAULT_REST_SEC = 90;

export const STARTER_GROUPS = [
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Core',
  'Cardio / Full body',
];

export function newId(): string {
  return crypto.randomUUID();
}

export class GymDB extends Dexie {
  clips!: Table<Clip, string>;
  groups!: Table<Group, string>;
  settings!: Table<Settings, string>;
  activeWorkout!: Table<ActiveWorkout, string>;
  pendingRestore!: Table<PendingRestore, string>;

  constructor(name = 'gym-tutorials') {
    super(name);
    this.version(1).stores({
      clips: 'id, mainGroupId, *extraGroupIds, order, sizeBytes',
      groups: 'id, order',
      settings: 'id',
      activeWorkout: 'id',
      pendingRestore: 'id',
    });
    this.on('populate', (tx) => {
      tx.table('groups').bulkAdd(STARTER_GROUPS.map((name, order) => ({ id: newId(), name, order })));
      tx.table('settings').add({
        id: 'settings',
        defaultRestSec: DEFAULT_REST_SEC,
        lastWorkoutGroupIds: [],
      } satisfies Settings);
    });
  }
}

export const db = new GymDB();

export async function getSettings(d: GymDB = db): Promise<Settings> {
  return (
    (await d.settings.get('settings')) ?? {
      id: 'settings',
      defaultRestSec: DEFAULT_REST_SEC,
      lastWorkoutGroupIds: [],
    }
  );
}

/** Next `order` value for a new clip: always the end of the list (never reordered in v1). */
export async function nextClipOrder(d: GymDB = db): Promise<number> {
  const last = await d.clips.orderBy('order').last();
  return last ? last.order + 1 : 0;
}

export function toMeta(clip: Clip): ClipMeta {
  const { video: _video, thumb: _thumb, ...meta } = clip;
  return meta;
}
