import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { db, getSettings, type ActiveWorkout, type Clip, type Group } from '../db';
import { buildDeck, countByGroup } from '../lib/deck';
import { useLive, useNow, useObjectUrl } from '../lib/hooks';
import { attachLoop } from '../lib/loop';
import {
  extendRest,
  formatRemaining,
  isWorkoutStale,
  restState,
  shouldVibrate,
  startRest,
  type RestState,
} from '../lib/restTimer';
import { goBack } from '../lib/router';
import { holdWakeLock } from '../lib/wakeLock';
import { ChipSelect } from './Chips';

// Gym screen. No list on the gym floor: pick today's groups, then a full-screen
// swipe deck. State lives in db.activeWorkout so a page discard or reload resumes
// at the same clip with the rest timer still counting (design doc + eng review).

function GroupPicker({ groups, clips, lastIds }: { groups: Group[]; clips: Clip[]; lastIds: string[] }) {
  const [ticked, setTicked] = useState<string[]>(() => lastIds.filter((id) => groups.some((g) => g.id === id)));
  const counts = useMemo(() => countByGroup(groups, clips), [groups, clips]);
  const deck = buildDeck(ticked, groups, clips);

  const start = async () => {
    const now = Date.now();
    await db.transaction('rw', db.activeWorkout, db.settings, async () => {
      await db.activeWorkout.put({ id: 'active', groupIds: ticked, deckIndex: 0, updatedAt: now });
      await db.settings.update('settings', { lastWorkoutGroupIds: ticked });
    });
  };

  return (
    <main class="screen">
      <header class="topbar">
        <button class="btn" onClick={() => goBack()}>
          ‹ Back
        </button>
        <h1>Today's groups</h1>
        <span />
      </header>
      <ChipSelect
        label="Today's groups"
        groups={groups}
        counts={counts}
        selected={ticked}
        onToggle={(id) => setTicked(ticked.includes(id) ? ticked.filter((t) => t !== id) : [...ticked, id])}
      />
      <footer class="bottom">
        <p class="muted" data-testid="deck-count">
          {deck.length} exercise{deck.length === 1 ? '' : 's'}
        </p>
        <button class="btn primary big" disabled={deck.length === 0} onClick={start}>
          ▶ Start
        </button>
      </footer>
    </main>
  );
}

function Slide({ clip, index, near, isCurrent }: { clip: Clip; index: number; near: boolean; isCurrent: boolean }) {
  const videoUrl = useObjectUrl(near ? clip.video : null);
  const thumbUrl = useObjectUrl(clip.thumb);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    return attachLoop(v, clip.loopStart, clip.loopEnd);
  }, [videoUrl, clip.loopStart, clip.loopEnd]);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (isCurrent) void v.play().catch(() => {});
    else v.pause();
  }, [isCurrent, videoUrl]);

  return (
    <section class="slide" data-index={index} data-testid="slide" aria-label={clip.name}>
      {near && videoUrl ? (
        <video ref={ref} src={videoUrl} poster={thumbUrl} muted playsInline loop preload="auto" />
      ) : (
        thumbUrl && <img src={thumbUrl} alt="" />
      )}
    </section>
  );
}

function Deck({ groups, clips, active }: { groups: Group[]; clips: Clip[]; active: ActiveWorkout }) {
  const items = useMemo(() => buildDeck(active.groupIds, groups, clips), [active.groupIds, groups, clips]);
  const byId = useMemo(() => new Map(clips.map((c) => [c.id, c])), [clips]);
  const groupName = useMemo(() => new Map(groups.map((g) => [g.id, g.name])), [groups]);
  const [current, setCurrent] = useState(() => Math.max(0, Math.min(active.deckIndex, items.length - 1)));
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => holdWakeLock(), []);

  useLayoutEffect(() => {
    const el = container.current?.children[current] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'start' });
  }, []);

  const currentRef = useRef(current);
  useEffect(() => {
    const root = container.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const i = Number((e.target as HTMLElement).dataset.index);
          if (i === currentRef.current) continue;
          currentRef.current = i;
          // Save in the same tick as the swipe, not in a post-paint effect: the
          // write transaction then exists before any later read (e.g. back + Resume).
          void db.activeWorkout.update('active', { deckIndex: i, updatedAt: Date.now() });
          setCurrent(i);
        }
      },
      { root, threshold: 0.6 },
    );
    Array.from(root.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [items.length]);

  const now = useNow(active.restEndsAt !== undefined);
  const rest: RestState = restState(active.restEndsAt, now);
  const prevKind = useRef<RestState['kind']>();
  useEffect(() => {
    if (shouldVibrate(prevKind.current, rest.kind)) navigator.vibrate?.([300, 150, 300]);
    prevKind.current = rest.kind;
  }, [rest.kind]);

  const touch = (patch: Partial<ActiveWorkout>) =>
    db.activeWorkout.update('active', { ...patch, updatedAt: Date.now() });

  const end = async () => {
    await db.activeWorkout.delete('active');
    goBack();
  };

  if (items.length === 0) {
    return (
      <main class="screen">
        <p>None of today's groups has clips any more.</p>
        <button class="btn primary big" onClick={end}>
          End workout
        </button>
      </main>
    );
  }

  const item = items[current];
  const clip = byId.get(item.clipId)!;

  return (
    <main class="deck-screen">
      <div class="deck" ref={container} data-testid="deck">
        {items.map((it, i) => (
          <Slide key={it.clipId} clip={byId.get(it.clipId)!} index={i} near={Math.abs(i - current) <= 1} isCurrent={i === current} />
        ))}
      </div>

      <div class="deck-top">
        <button class="pill" onClick={end}>
          ✕ End
        </button>
        <span class="pill" data-testid="deck-position">
          {groupName.get(item.groupId)} · {current + 1} / {items.length}
        </span>
      </div>

      <div class="deck-bottom">
        <div class="name-card">
          <strong data-testid="clip-name">{clip.name}</strong>
          <span class="muted">{current < items.length - 1 ? 'swipe up for next' : 'last exercise'}</span>
        </div>

        {rest.kind === 'running' && (
          <div class="rest" role="timer" aria-live="off">
            <span>Rest</span>
            <b data-testid="rest-remaining">{formatRemaining(rest.remainingMs)}</b>
            <button class="pill" onClick={() => touch({ restEndsAt: extendRest(active.restEndsAt, Date.now()) })}>
              +15s
            </button>
          </div>
        )}
        {rest.kind === 'over' && (
          <button class="rest over" data-testid="rest-over" onClick={() => touch({ restEndsAt: undefined })}>
            Rest over · tap to dismiss
          </button>
        )}

        <button
          class="btn primary big"
          onClick={() => touch({ restEndsAt: startRest(Date.now(), clip.restSec) })}
        >
          Set done → start rest
        </button>
      </div>
    </main>
  );
}

export function WorkoutDeck() {
  const groups = useLive(() => db.groups.orderBy('order').toArray());
  const clips = useLive(() => db.clips.orderBy('order').toArray());
  const active = useLive(() => db.activeWorkout.get('active').then((a) => a ?? null));
  const settings = useLive(() => getSettings());

  if (!groups || !clips || active === undefined || !settings) return <main class="screen" aria-busy="true" />;
  if (!active || isWorkoutStale(active.updatedAt, Date.now())) {
    return <GroupPicker groups={groups} clips={clips} lastIds={settings.lastWorkoutGroupIds} />;
  }
  return <Deck groups={groups} clips={clips} active={active} />;
}
