import { useEffect, useState } from 'preact/hooks';
import { registerSW } from 'virtual:pwa-register';

// registerType 'prompt': a downloaded update waits until you tap "Update now" in
// Settings (or the app is fully closed). It never reloads during a workout.

let needRefresh = false;
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;
const listeners = new Set<() => void>();

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  updateSW = registerSW({
    onNeedRefresh() {
      needRefresh = true;
      listeners.forEach((l) => l());
    },
  });
}

export function useUpdate(): { available: boolean; apply: () => void } {
  const [available, setAvailable] = useState(needRefresh);
  useEffect(() => {
    const l = () => setAvailable(true);
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return { available, apply: () => void updateSW?.(true) };
}
