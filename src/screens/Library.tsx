import { useState } from 'preact/hooks';
import { db, getSettings, type Clip } from '../db';
import { clipsInGroup, countByGroup } from '../lib/deck';
import { useLive, useObjectUrl } from '../lib/hooks';
import { hasTrim } from '../lib/loop';
import { isWorkoutStale } from '../lib/restTimer';
import { navigate } from '../lib/router';

function formatDuration(sec: number) {
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function Thumb({ clip }: { clip: Clip }) {
  const url = useObjectUrl(clip.thumb);
  return (
    <button
      class="thumb"
      data-testid="clip-thumb"
      aria-label={`Edit ${clip.name}`}
      onClick={() => navigate(`/edit/${encodeURIComponent(clip.id)}`)}
    >
      {url && <img src={url} alt="" loading="lazy" />}
      <span class="thumb-label">
        {clip.name}
        <span class="thumb-meta">{hasTrim(clip) ? ' ✂' : ` · ${formatDuration(clip.durationSec)}`}</span>
      </span>
    </button>
  );
}

export function Library() {
  const groups = useLive(() => db.groups.orderBy('order').toArray());
  const clips = useLive(() => db.clips.orderBy('order').toArray());
  const active = useLive(() => db.activeWorkout.get('active'));
  const settings = useLive(() => getSettings());
  const [filter, setFilter] = useState<string | null>(null);

  if (!groups || !clips || !settings) return <main class="screen" aria-busy="true" />;

  const counts = countByGroup(groups, clips);
  const shown = filter ? clipsInGroup(filter, clips) : clips;
  const resumable = active && !isWorkoutStale(active.updatedAt, Date.now());
  const empty = clips.length === 0;

  return (
    <main class="screen library">
      <header class="topbar">
        <h1>Gym tutorials</h1>
        <div class="topbar-actions">
          <button class="btn icon" aria-label="Settings" onClick={() => navigate('/settings')}>
            ⚙
          </button>
          <button class="btn" onClick={() => navigate('/add')}>
            + Add
          </button>
        </div>
      </header>

      {resumable && (
        <button class="resume-bar" onClick={() => navigate('/workout')}>
          Workout in progress · <strong>Resume</strong>
        </button>
      )}

      {!empty && settings.persistGranted === false && (
        <p class="banner" role="status">
          Chrome may clear videos when space runs low. Export a backup in Settings.
        </p>
      )}

      {empty ? (
        <section class="empty" aria-label="Empty library">
          <p>No clips yet. Add the exercise videos you saved to your phone.</p>
          <button class="btn primary big" onClick={() => navigate('/add')}>
            Add your first clips
          </button>
          <button class="link" onClick={() => navigate('/settings')}>
            Restore from backup
          </button>
        </section>
      ) : (
        <>
          <nav class="chips" aria-label="Muscle groups">
            <button class={`chip ${filter === null ? 'on' : ''}`} aria-pressed={filter === null} onClick={() => setFilter(null)}>
              All {clips.length}
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                class={`chip ${filter === g.id ? 'on' : ''} ${counts.get(g.id) ? '' : 'dim'}`}
                aria-pressed={filter === g.id}
                onClick={() => setFilter(g.id)}
              >
                {g.name} {counts.get(g.id) ?? 0}
              </button>
            ))}
          </nav>
          {shown.length === 0 ? (
            <p class="muted">No clips in this group yet.</p>
          ) : (
            <div class="grid">
              {shown.map((c) => (
                <Thumb key={c.id} clip={c} />
              ))}
            </div>
          )}
        </>
      )}

      <footer class="bottom">
        <button class="btn primary big" disabled={empty} onClick={() => navigate('/workout')}>
          ▶ {resumable ? 'Resume workout' : 'Start workout'}
        </button>
      </footer>
    </main>
  );
}
