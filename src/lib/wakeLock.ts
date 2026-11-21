// Keep the screen on during a workout. Android releases the lock whenever the page
// is hidden, so it is requested again each time the page becomes visible.
// Returns a release function for cleanup.

export function holdWakeLock(): () => void {
  if (!('wakeLock' in navigator)) return () => {};
  let sentinel: WakeLockSentinel | null = null;
  let stopped = false;

  const acquire = async () => {
    if (stopped || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
    } catch {
      // Denied (battery saver, unsupported context). The workout still works.
    }
  };
  const onVisible = () => void acquire();

  void acquire();
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', onVisible);
    void sentinel?.release().catch(() => {});
  };
}
