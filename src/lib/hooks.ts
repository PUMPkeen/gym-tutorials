import { liveQuery } from 'dexie';
import { useEffect, useState } from 'preact/hooks';

/** Re-runs a Dexie query whenever the tables it reads change. undefined = loading. */
export function useLive<T>(query: () => Promise<T>, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(query).subscribe({
      next: (v) => setValue(() => v),
      error: (e) => console.error(e),
    });
    return () => sub.unsubscribe();
  }, deps);
  return value;
}

/** Object URL for a Blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Current time, refreshed every `ms` while `active`. */
export function useNow(active: boolean, ms = 250): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [active, ms]);
  return now;
}
