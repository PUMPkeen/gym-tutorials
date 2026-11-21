// Rep loop (design doc: "Loop precision" / "Loop seam").
//
//   [ intro talk ][ loopStart ── the rep ── loopEnd ][ outro ]
//                      ^__________ seek back _________|
//
// Checked on every decoded frame with requestVideoFrameCallback (frame-accurate);
// falls back to timeupdate (~250 ms) where rVFC is missing. A small hitch at the
// seam is accepted in v1 (non-keyframe seeks).

/** Pure: where to seek, or null to keep playing. */
export function loopSeekTarget(mediaTime: number, loopStart?: number, loopEnd?: number): number | null {
  if (loopStart === undefined || loopEnd === undefined || loopEnd <= loopStart) return null;
  if (mediaTime >= loopEnd || mediaTime < loopStart - 0.25) return loopStart;
  return null;
}

export function hasTrim(c: { loopStart?: number; loopEnd?: number }): boolean {
  return c.loopStart !== undefined && c.loopEnd !== undefined && c.loopEnd > c.loopStart;
}

type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

/** Keep `video` looping between loopStart and loopEnd. Returns a detach function. */
export function attachLoop(video: HTMLVideoElement, loopStart?: number, loopEnd?: number): () => void {
  video.loop = true;
  if (!hasTrim({ loopStart, loopEnd })) return () => {};

  const v = video as RVFCVideo;
  const jump = (mediaTime: number) => {
    const target = loopSeekTarget(mediaTime, loopStart, loopEnd);
    if (target !== null) v.currentTime = target;
  };

  if (v.currentTime < (loopStart as number) || v.currentTime >= (loopEnd as number)) {
    v.currentTime = loopStart as number;
  }

  if (v.requestVideoFrameCallback && v.cancelVideoFrameCallback) {
    let handle = 0;
    let active = true;
    const onFrame = (_now: number, meta: { mediaTime: number }) => {
      if (!active) return;
      jump(meta.mediaTime);
      handle = v.requestVideoFrameCallback!(onFrame);
    };
    handle = v.requestVideoFrameCallback(onFrame);
    return () => {
      active = false;
      v.cancelVideoFrameCallback!(handle);
    };
  }

  const onTime = () => jump(v.currentTime);
  v.addEventListener('timeupdate', onTime);
  return () => v.removeEventListener('timeupdate', onTime);
}
