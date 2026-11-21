import { useEffect, useState } from 'preact/hooks';
import { db, getSettings, newId, toMeta, type Group, type Manifest } from '../db';
import { buildManifest, ManifestError, matchFile, parseManifest, unmatchedEntries } from '../lib/backup';
import { useLive } from '../lib/hooks';
import { probeVideo, requestPersistence, saveRestoredClip } from '../lib/importVideo';
import { goBack, replaceRoute } from '../lib/router';
import { useUpdate } from '../pwa';

function formatBytes(n: number) {
  if (n >= 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  return `${Math.round(n / 1e6)} MB`;
}

function GroupsEditor({ groups }: { groups: Group[] }) {
  const [newName, setNewName] = useState('');
  const move = async (i: number, dir: -1 | 1) => {
    const a = groups[i];
    const b = groups[i + dir];
    if (!a || !b) return;
    await db.transaction('rw', db.groups, async () => {
      await db.groups.update(a.id, { order: b.order });
      await db.groups.update(b.id, { order: a.order });
    });
  };
  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const last = groups[groups.length - 1];
    await db.groups.add({ id: newId(), name, order: last ? last.order + 1 : 0 });
    setNewName('');
  };
  return (
    <section class="card" aria-label="Muscle groups">
      <h2>Muscle groups</h2>
      <ul class="group-list">
        {groups.map((g, i) => (
          <li key={g.id}>
            <input
              type="text"
              value={g.name}
              aria-label={`Rename ${g.name}`}
              onChange={(e) => {
                const name = (e.currentTarget as HTMLInputElement).value.trim();
                if (name) void db.groups.update(g.id, { name });
              }}
            />
            <button class="btn icon" aria-label={`Move ${g.name} up`} disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button
              class="btn icon"
              aria-label={`Move ${g.name} down`}
              disabled={i === groups.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </li>
        ))}
      </ul>
      <div class="row">
        <input
          type="text"
          placeholder="New group"
          aria-label="New group name"
          value={newName}
          onInput={(e) => setNewName((e.currentTarget as HTMLInputElement).value)}
        />
        <button class="btn" onClick={add} disabled={!newName.trim()}>
          Add group
        </button>
      </div>
    </section>
  );
}

function RestoreSection({ clipCount }: { clipCount: number }) {
  const pending = useLive(() => db.pendingRestore.get('pending').then((p) => p ?? null));
  const [notes, setNotes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  if (pending === undefined) return null;

  const startRestore = async (file: File) => {
    setError(undefined);
    let manifest: Manifest;
    try {
      manifest = parseManifest(await file.text());
    } catch (e) {
      setError(e instanceof ManifestError ? e.message : 'Could not read that file.');
      return;
    }
    // Groups and settings first, so restored clips point at the right group ids.
    await db.transaction('rw', db.pendingRestore, db.groups, db.settings, async () => {
      await db.pendingRestore.put({ id: 'pending', manifest, matchedIds: [] });
      await db.groups.clear();
      await db.groups.bulkAdd(manifest.groups);
      await db.settings.update('settings', { defaultRestSec: manifest.settings.defaultRestSec });
    });
  };

  const addVideos = async (files: File[]) => {
    if (!pending) return;
    setBusy(true);
    const out: string[] = [];
    let matched = [...pending.matchedIds];
    for (const file of files) {
      try {
        const probe = await probeVideo(file);
        const entry = matchFile(
          { name: file.name, sizeBytes: file.size, durationSec: probe.durationSec },
          pending.manifest.clips,
          matched,
        );
        if (!entry) {
          out.push(`“${file.name}” is not in this backup.`);
          continue;
        }
        await saveRestoredClip(file, probe, entry);
        matched = [...matched, entry.id];
      } catch (e) {
        out.push(`“${file.name}” was skipped: ${(e as Error).message}.`);
      }
    }
    setNotes(out);
    setBusy(false);
    if (unmatchedEntries(pending.manifest, matched).length === 0) await finish();
  };

  const finish = async () => {
    await db.pendingRestore.delete('pending');
    replaceRoute('/library');
  };

  if (pending) {
    const missing = unmatchedEntries(pending.manifest, pending.matchedIds);
    const total = pending.manifest.clips.length;
    return (
      <section class="card" aria-label="Restore">
        <h2>Restore in progress</h2>
        <p data-testid="restore-progress">
          Restored {total - missing.length} of {total} clips. Pick the original videos from your phone; you can do it
          in several rounds.
        </p>
        <label class="btn primary big file-btn" aria-busy={busy}>
          {busy ? 'Restoring…' : 'Pick videos'}
          <input
            type="file"
            accept="video/*"
            multiple
            disabled={busy}
            data-testid="restore-videos"
            onChange={(e) => void addVideos(Array.from((e.currentTarget as HTMLInputElement).files ?? []))}
          />
        </label>
        {missing.length > 0 && (
          <details>
            <summary>Still missing ({missing.length})</summary>
            <ul>
              {missing.map((m) => (
                <li key={m.id}>
                  {m.name} <span class="muted">({m.sourceFileName})</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        {notes.length > 0 && (
          <ul class="messages" role="alert">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <button class="btn" onClick={finish}>
          Finish (drop {missing.length} missing)
        </button>
      </section>
    );
  }

  if (clipCount > 0) {
    return (
      <section class="card" aria-label="Restore">
        <h2>Restore</h2>
        <p class="muted">Restore works on an empty library only.</p>
      </section>
    );
  }

  return (
    <section class="card" aria-label="Restore">
      <h2>Restore from backup</h2>
      <p class="muted">Pick the backup file first, then the original videos.</p>
      <label class="btn primary big file-btn">
        Pick backup file
        <input
          type="file"
          accept=".json,application/json"
          data-testid="restore-manifest"
          onChange={(e) => {
            const f = (e.currentTarget as HTMLInputElement).files?.[0];
            if (f) void startRestore(f);
          }}
        />
      </label>
      {error && (
        <p class="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function Settings() {
  const groups = useLive(() => db.groups.orderBy('order').toArray());
  const clips = useLive(() => db.clips.orderBy('order').toArray());
  const settings = useLive(() => getSettings());
  const update = useUpdate();
  const [storage, setStorage] = useState<{ usage: number; quota: number }>();

  useEffect(() => {
    void navigator.storage?.estimate?.().then((e) => setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }));
  }, [clips?.length]);

  if (!groups || !clips || !settings) return <main class="screen" aria-busy="true" />;

  const exportBackup = () => {
    const manifest = buildManifest(groups, settings, clips.map(toMeta));
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gym-tutorials-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const restore = <RestoreSection clipCount={clips.length} />;

  return (
    <main class="screen settings">
      <header class="topbar">
        <button class="btn" onClick={() => goBack()}>
          ‹ Back
        </button>
        <h1>Settings</h1>
        <span />
      </header>

      {update.available && (
        <button class="resume-bar" onClick={update.apply}>
          Update available · <strong>Update now</strong>
        </button>
      )}

      {clips.length === 0 && restore}

      <GroupsEditor groups={groups} />

      <section class="card" aria-label="Rest">
        <h2>Rest timer</h2>
        <label class="field">
          <span>Default rest for new clips (seconds)</span>
          <input
            type="number"
            min={10}
            max={600}
            step={5}
            value={settings.defaultRestSec}
            aria-label="Default rest seconds"
            onChange={(e) => {
              const v = Math.round(Number((e.currentTarget as HTMLInputElement).value));
              if (v >= 10 && v <= 600) void db.settings.update('settings', { defaultRestSec: v });
            }}
          />
        </label>
      </section>

      <section class="card" aria-label="Storage">
        <h2>Storage</h2>
        <p>
          {clips.length} clips
          {storage ? ` · using ${formatBytes(storage.usage)} of ${formatBytes(storage.quota)} available to the app` : ''}
        </p>
        {settings.persistGranted ? (
          <p class="muted">Protected: Chrome won't clear these videos automatically.</p>
        ) : (
          <>
            <p class="banner">Not protected: Chrome may clear videos when space runs low.</p>
            <button class="btn" onClick={() => void requestPersistence()}>
              Ask Chrome to keep videos
            </button>
          </>
        )}
      </section>

      <section class="card" aria-label="Backup">
        <h2>Backup</h2>
        <p class="muted">
          Saves names, groups, trims and rest times. The videos themselves are not in the file, so keep the originals in
          your gallery.
        </p>
        <button class="btn" onClick={exportBackup} disabled={clips.length === 0}>
          Export backup
        </button>
      </section>

      {clips.length > 0 && restore}
    </main>
  );
}
