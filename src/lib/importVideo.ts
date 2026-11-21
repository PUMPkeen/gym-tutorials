import { db, getSettings, newId, nextClipOrder, type Clip, type GymDB, type ManifestClip } from '../db';

// One import path for Add AND Restore (eng review T5).
//
//   File ──probeVideo()──> playable? ──no──> UnplayableError (clip refused, message shown)
//                              │yes
//                              ▼
//            { durationSec, thumb } ──saveNewClip() / saveRestoredClip()──> db.clips
//                                                      │ QuotaExceeded
//                                                      ▼
//                                               StorageFullError (others kept)
//
// Playable means: metadata loads, seeking to ~1 s works, videoWidth > 0 and a
// non-empty JPEG frame can be drawn, all within 5 s. `loadedmetadata` alone is not
// enough: a file whose video track can't be decoded still fires it.

export class UnplayableError extends Error {}
export class StorageFullError extends Error {}

export const PROBE_TIMEOUT_MS = 5000;
const THUMB_MAX_WIDTH = 360;

export interface ProbeResult {
  durationSec: number;
  thumb: Blob;
}

/** Pure: why a probe result is unplayable, or null when it is fine. */
export function assessProbe(p: { durationSec: number; videoWidth: number; thumbBytes: number }): string | null {
  if (!Number.isFinite(p.durationSec) || p.durationSec <= 0) return 'it has no readable length';
  if (p.videoWidth <= 0) return 'this phone cannot decode its picture';
  if (p.thumbBytes <= 0) return 'no frame could be drawn from it';
  return null;
}

/** Thumbnail frame: 1 s in, or the middle of very short clips. */
export function thumbSeekTime(durationSec: number): number {
  return Math.min(1, durationSec / 2);
}

export function isQuotaError(e: unknown): boolean {
  const err = e as { name?: string; inner?: { name?: string } } | null;
  return err?.name === 'QuotaExceededError' || err?.inner?.name === 'QuotaExceededError';
}

function waitFor(video: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const fail = () => {
      cleanup();
      reject(new UnplayableError('the file could not be decoded'));
    };
    const cleanup = () => {
      video.removeEventListener(event, ok);
      video.removeEventListener('error', fail);
    };
    video.addEventListener(event, ok);
    video.addEventListener('error', fail);
  });
}

function waitForFiniteDuration(video: HTMLVideoElement): Promise<void> {
  // Some WebM files (e.g. MediaRecorder output) report duration = Infinity until the
  // end is reached. Seeking far forward makes the browser work out the real length.
  return new Promise((resolve) => {
    const check = () => {
      if (Number.isFinite(video.duration)) {
        video.removeEventListener('durationchange', check);
        video.removeEventListener('timeupdate', check);
        resolve();
      }
    };
    video.addEventListener('durationchange', check);
    video.addEventListener('timeupdate', check);
    video.currentTime = 1e7;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? new Blob()), 'image/jpeg', 0.72));
}

export async function probeVideo(file: Blob, timeoutMs = PROBE_TIMEOUT_MS): Promise<ProbeResult> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  let timer: ReturnType<typeof setTimeout> | undefined;

  const run = async (): Promise<ProbeResult> => {
    const loaded = waitFor(video, 'loadedmetadata');
    video.src = url;
    await loaded;
    if (!Number.isFinite(video.duration)) await waitForFiniteDuration(video);
    const durationSec = video.duration;

    const seeked = waitFor(video, 'seeked');
    video.currentTime = thumbSeekTime(durationSec);
    await seeked;

    let thumb = new Blob();
    if (video.videoWidth > 0) {
      const scale = Math.min(1, THUMB_MAX_WIDTH / video.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
      thumb = await canvasToJpeg(canvas);
    }
    const problem = assessProbe({ durationSec, videoWidth: video.videoWidth, thumbBytes: thumb.size });
    if (problem) throw new UnplayableError(problem);
    return { durationSec, thumb };
  };

  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new UnplayableError('it did not load within 5 seconds')), timeoutMs);
  });

  try {
    return await Promise.race([run(), deadline]);
  } finally {
    clearTimeout(timer);
    video.removeAttribute('src');
    video.load();
    URL.revokeObjectURL(url);
  }
}

export interface NewClipInput {
  file: File;
  probe: ProbeResult;
  name: string;
  mainGroupId: string;
  extraGroupIds: string[];
  loopStart?: number;
  loopEnd?: number;
}

async function addOrPut(d: GymDB, clip: Clip, mode: 'add' | 'put') {
  try {
    if (mode === 'add') await d.clips.add(clip);
    else await d.clips.put(clip);
  } catch (e) {
    if (isQuotaError(e)) {
      throw new StorageFullError('The phone ran out of space for this clip. Clips saved earlier are kept.');
    }
    throw e;
  }
}

export async function saveNewClip(input: NewClipInput, d: GymDB = db): Promise<Clip> {
  const settings = await getSettings(d);
  const clip: Clip = {
    id: newId(),
    name: input.name.trim() || input.file.name,
    mainGroupId: input.mainGroupId,
    extraGroupIds: input.extraGroupIds.filter((g) => g !== input.mainGroupId),
    order: await nextClipOrder(d),
    createdAt: Date.now(),
    mime: input.file.type || 'video/mp4',
    durationSec: input.probe.durationSec,
    sizeBytes: input.file.size,
    loopStart: input.loopStart,
    loopEnd: input.loopEnd,
    restSec: settings.defaultRestSec,
    sourceFileName: input.file.name,
    video: input.file,
    thumb: input.probe.thumb,
  };
  await addOrPut(d, clip, 'add');
  await requestPersistence(d);
  return clip;
}

/** Restore keeps the manifest's id, order, groups, trims and rest time. */
export async function saveRestoredClip(
  file: File,
  probe: ProbeResult,
  entry: ManifestClip,
  d: GymDB = db,
): Promise<Clip> {
  const clip: Clip = {
    ...entry,
    createdAt: Date.now(),
    mime: file.type || 'video/mp4',
    durationSec: probe.durationSec,
    sizeBytes: file.size,
    video: file,
    thumb: probe.thumb,
  };
  await d.transaction('rw', d.clips, d.pendingRestore, async () => {
    await addOrPut(d, clip, 'put');
    const pending = await d.pendingRestore.get('pending');
    if (pending && !pending.matchedIds.includes(entry.id)) {
      await d.pendingRestore.put({ ...pending, matchedIds: [...pending.matchedIds, entry.id] });
    }
  });
  await requestPersistence(d);
  return clip;
}

/** Ask Chrome not to evict our storage. Installed apps are usually granted this. */
export async function requestPersistence(d: GymDB = db): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  const granted = (await navigator.storage.persisted()) || (await navigator.storage.persist());
  await d.settings.update('settings', { persistGranted: granted });
  return granted;
}
