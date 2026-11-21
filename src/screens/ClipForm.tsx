import { useEffect, useRef, useState, type Dispatch, type StateUpdater } from 'preact/hooks';
import { db, type Group } from '../db';
import { findDuplicate } from '../lib/backup';
import { useLive, useObjectUrl } from '../lib/hooks';
import { probeVideo, saveNewClip, StorageFullError, type ProbeResult } from '../lib/importVideo';
import { attachLoop } from '../lib/loop';
import { goBack } from '../lib/router';
import { ChipSelect } from './Chips';

// Add clips (step through picked files) and Edit clip share these fields.
// Back gesture / Cancel = leave without saving (eng review R1).

type Mode = { kind: 'add' } | { kind: 'edit'; id: string };

interface Fields {
  name: string;
  mainGroupId: string;
  extraGroupIds: string[];
  trimOn: boolean;
  loopStart: number;
  loopEnd: number;
  restSec: number;
}

const MIN_LOOP_SEC = 0.3;

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

function Preview({ src, fields }: { src?: string; fields: Fields }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || !src) return;
    return fields.trimOn ? attachLoop(v, fields.loopStart, fields.loopEnd) : attachLoop(v);
  }, [src, fields.trimOn, fields.loopStart, fields.loopEnd]);
  return <video ref={ref} class="preview" src={src} muted playsInline autoPlay loop data-testid="preview" />;
}

function FieldsEditor({
  groups,
  fields,
  setFields,
  durationSec,
  showRest,
}: {
  groups: Group[];
  fields: Fields;
  setFields: Dispatch<StateUpdater<Fields>>;
  durationSec: number;
  showRest: boolean;
}) {
  // Always update from the latest state: two quick taps (type a name, then toggle
  // trim) must not let the second handler overwrite the first with a stale copy.
  const set = (patch: Partial<Fields> | ((f: Fields) => Partial<Fields>)) =>
    setFields((prev) => ({ ...prev, ...(typeof patch === 'function' ? patch(prev) : patch) }));
  const dur = Math.max(0.1, Math.floor(durationSec * 10) / 10);
  return (
    <div class="fields">
      <label class="trim-toggle">
        <input
          type="checkbox"
          checked={fields.trimOn}
          onChange={(e) => {
            const trimOn = (e.currentTarget as HTMLInputElement).checked;
            set((f) => ({ trimOn, loopEnd: f.loopEnd > f.loopStart ? f.loopEnd : dur }));
          }}
        />
        Loop only the movement (optional)
      </label>
      {fields.trimOn && (
        <div class="trim">
          <label>
            Loop start {fields.loopStart.toFixed(1)} s
            <input
              type="range"
              min={0}
              max={dur}
              step={0.1}
              value={fields.loopStart}
              aria-label="Loop start"
              onInput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                set((f) => ({ loopStart: Math.max(0, Math.min(v, f.loopEnd - MIN_LOOP_SEC)) }));
              }}
            />
          </label>
          <label>
            Loop end {fields.loopEnd.toFixed(1)} s
            <input
              type="range"
              min={0}
              max={dur}
              step={0.1}
              value={fields.loopEnd}
              aria-label="Loop end"
              onInput={(e) => {
                const v = Number((e.currentTarget as HTMLInputElement).value);
                set((f) => ({ loopEnd: Math.min(dur, Math.max(v, f.loopStart + MIN_LOOP_SEC)) }));
              }}
            />
          </label>
        </div>
      )}

      <label class="field">
        <span>Name</span>
        <input
          type="text"
          value={fields.name}
          onInput={(e) => set({ name: (e.currentTarget as HTMLInputElement).value })}
          aria-label="Name"
        />
      </label>

      <p class="label">Main group</p>
      <ChipSelect
        label="Main group"
        single
        groups={groups}
        selected={fields.mainGroupId ? [fields.mainGroupId] : []}
        onToggle={(id) => set((f) => ({ mainGroupId: id, extraGroupIds: f.extraGroupIds.filter((g) => g !== id) }))}
      />

      <p class="label">Also works (optional)</p>
      <ChipSelect
        label="Also works"
        groups={groups}
        exclude={fields.mainGroupId ? [fields.mainGroupId] : []}
        selected={fields.extraGroupIds}
        onToggle={(id) =>
          set((f) => ({
            extraGroupIds: f.extraGroupIds.includes(id) ? f.extraGroupIds.filter((g) => g !== id) : [...f.extraGroupIds, id],
          }))
        }
      />

      {showRest && (
        <label class="field">
          <span>Rest after each set (seconds)</span>
          <input
            type="number"
            min={10}
            max={600}
            step={5}
            value={fields.restSec}
            aria-label="Rest seconds"
            onInput={(e) => {
              const v = Number((e.currentTarget as HTMLInputElement).value);
              if (v) set({ restSec: v });
            }}
          />
        </label>
      )}
    </div>
  );
}

type ProbeState = { status: 'loading' } | { status: 'ok'; result: ProbeResult };

function AddClips() {
  const groups = useLive(() => db.groups.orderBy('order').toArray());
  const existing = useLive(() => db.clips.toArray());
  const [files, setFiles] = useState<File[] | null>(null);
  const [index, setIndex] = useState(0);
  const [probe, setProbe] = useState<ProbeState>({ status: 'loading' });
  const [skipped, setSkipped] = useState<string[]>([]);
  const [saved, setSaved] = useState(0);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [lastMain, setLastMain] = useState('');
  const [fields, setFields] = useState<Fields>({
    name: '',
    mainGroupId: '',
    extraGroupIds: [],
    trimOn: false,
    loopStart: 0,
    loopEnd: 0,
    restSec: 90,
  });

  const file = files?.[index];
  const fileUrl = useObjectUrl(probe.status === 'ok' ? file : undefined);

  const advance = (skippedMsg?: string) => {
    const nextSkipped = skippedMsg ? [...skipped, skippedMsg] : skipped;
    if (skippedMsg) setSkipped(nextSkipped);
    if (files && index + 1 < files.length) {
      // Hide the form in the same render that switches files, so nothing typed
      // between "Save & next" and the reset can land on the next clip.
      setProbe({ status: 'loading' });
      setIndex(index + 1);
    }
    else if (nextSkipped.length > 0) setFinished(true);
    else goBack();
  };

  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setError(undefined);
    setProbe({ status: 'loading' });
    setFields((f) => ({
      ...f,
      name: baseName(file.name),
      mainGroupId: lastMain,
      extraGroupIds: [],
      trimOn: false,
      loopStart: 0,
      loopEnd: 0,
    }));
    probeVideo(file).then(
      (result) => {
        if (cancelled) return;
        setFields((f) => ({ ...f, loopEnd: result.durationSec }));
        setProbe({ status: 'ok', result });
      },
      (e: Error) => {
        if (!cancelled) advance(`“${file.name}” was skipped: ${e.message}.`);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!groups || !existing) return <main class="screen" aria-busy="true" />;

  if (finished) {
    return (
      <main class="screen">
        <header class="topbar">
          <h1>Import finished</h1>
        </header>
        <p>{saved} clip(s) saved.</p>
        <ul class="messages" role="alert">
          {skipped.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
        <button class="btn primary big" onClick={() => goBack()}>
          Done
        </button>
      </main>
    );
  }

  if (!files) {
    return (
      <main class="screen">
        <header class="topbar">
          <button class="btn" onClick={() => goBack()}>
            ‹ Cancel
          </button>
          <h1>Add clips</h1>
        </header>
        <p class="muted">Pick one or more exercise videos from your phone. You'll name and group them one by one.</p>
        <label class="btn primary big file-btn">
          Pick videos
          <input
            type="file"
            accept="video/*"
            multiple
            data-testid="pick-videos"
            onChange={(e) => {
              const list = Array.from((e.currentTarget as HTMLInputElement).files ?? []);
              if (list.length) setFiles(list);
            }}
          />
        </label>
      </main>
    );
  }

  const duplicate =
    probe.status === 'ok' && file
      ? findDuplicate({ name: file.name, sizeBytes: file.size, durationSec: probe.result.durationSec }, existing)
      : undefined;

  const save = async () => {
    if (!file || probe.status !== 'ok' || saving) return;
    // Lock the form while saving so nothing typed in the meantime is lost on a clip
    // that is already being stored.
    setSaving(true);
    try {
      await saveNewClip({
        file,
        probe: probe.result,
        name: fields.name,
        mainGroupId: fields.mainGroupId,
        extraGroupIds: fields.extraGroupIds,
        loopStart: fields.trimOn ? fields.loopStart : undefined,
        loopEnd: fields.trimOn ? fields.loopEnd : undefined,
      });
      setSaved(saved + 1);
      setLastMain(fields.mainGroupId);
      setSaving(false);
      advance();
    } catch (e) {
      setSaving(false);
      setError(e instanceof StorageFullError ? e.message : `Could not save: ${(e as Error).message}`);
    }
  };

  return (
    <main class="screen form">
      <header class="topbar">
        <button class="btn" onClick={() => goBack()}>
          ‹ Cancel
        </button>
        <h1 data-testid="add-progress">
          {index + 1} / {files.length}
        </h1>
        <button class="btn" onClick={() => advance()}>
          Skip ›
        </button>
      </header>
      {probe.status === 'loading' ? (
        <p class="muted" role="status">
          Checking “{file?.name}”…
        </p>
      ) : (
        <fieldset class="plain" disabled={saving} aria-busy={saving}>
          <Preview src={fileUrl} fields={fields} />
          {duplicate && (
            <p class="banner" role="status">
              Looks like a duplicate of “{duplicate.name}”. Save anyway, or Skip.
            </p>
          )}
          <FieldsEditor
            groups={groups}
            fields={fields}
            setFields={setFields}
            durationSec={probe.result.durationSec}
            showRest={false}
          />
          {error && (
            <p class="error" role="alert">
              {error}
            </p>
          )}
          <button class="btn primary big" disabled={!fields.mainGroupId} onClick={save}>
            {saving ? 'Saving…' : 'Save & next'}
          </button>
        </fieldset>
      )}
      {skipped.length > 0 && (
        <ul class="messages" role="alert">
          {skipped.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </main>
  );
}

function EditClip({ id }: { id: string }) {
  const groups = useLive(() => db.groups.orderBy('order').toArray());
  const clip = useLive(() => db.clips.get(id).then((c) => c ?? null), [id]);
  const url = useObjectUrl(clip?.video);
  const [fields, setFields] = useState<Fields | null>(null);

  useEffect(() => {
    if (!clip || fields) return;
    setFields({
      name: clip.name,
      mainGroupId: clip.mainGroupId,
      extraGroupIds: clip.extraGroupIds,
      trimOn: clip.loopStart !== undefined && clip.loopEnd !== undefined,
      loopStart: clip.loopStart ?? 0,
      loopEnd: clip.loopEnd ?? clip.durationSec,
      restSec: clip.restSec,
    });
  }, [clip]);

  if (clip === null) {
    return (
      <main class="screen">
        <p>This clip no longer exists.</p>
        <button class="btn" onClick={() => goBack()}>
          Back
        </button>
      </main>
    );
  }
  if (!groups || !clip || !fields) return <main class="screen" aria-busy="true" />;

  const save = async () => {
    await db.clips.update(id, {
      name: fields.name.trim() || clip.name,
      mainGroupId: fields.mainGroupId,
      extraGroupIds: fields.extraGroupIds.filter((g) => g !== fields.mainGroupId),
      loopStart: fields.trimOn ? fields.loopStart : undefined,
      loopEnd: fields.trimOn ? fields.loopEnd : undefined,
      restSec: Math.min(600, Math.max(10, Math.round(fields.restSec))),
    });
    goBack();
  };

  const remove = async () => {
    if (!confirm(`Delete “${clip.name}”? The video is removed from the app (your gallery copy stays).`)) return;
    await db.clips.delete(id);
    goBack();
  };

  return (
    <main class="screen form">
      <header class="topbar">
        <button class="btn" onClick={() => goBack()}>
          ‹ Cancel
        </button>
        <h1>Edit clip</h1>
        <span />
      </header>
      <Preview src={url} fields={fields} />
      <FieldsEditor
        groups={groups}
        fields={fields}
        setFields={setFields as Dispatch<StateUpdater<Fields>>}
        durationSec={clip.durationSec}
        showRest
      />
      <button class="btn primary big" disabled={!fields.mainGroupId} onClick={save}>
        Save
      </button>
      <button class="btn danger" onClick={remove}>
        Delete clip
      </button>
    </main>
  );
}

export function ClipForm({ mode }: { mode: Mode }) {
  return mode.kind === 'add' ? <AddClips /> : <EditClip id={mode.id} />;
}
