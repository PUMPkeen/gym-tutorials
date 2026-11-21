import { render } from 'preact';
import { App } from './app';
import { db } from './db';
import { bootHistory, parseHash } from './lib/router';
import { isWorkoutStale } from './lib/restTimer';
import { initPwa } from './pwa';
import './styles.css';

async function boot() {
  // Resume a workout under 3 hours old straight into the deck. Otherwise drop it and
  // never reopen the workout screen on launch: an expired workout opens the Library.
  const active = await db.activeWorkout.get('active');
  let initial: string | undefined;
  if (active && !isWorkoutStale(active.updatedAt, Date.now())) initial = '/workout';
  else {
    if (active) await db.activeWorkout.delete('active');
    if (parseHash(location.hash).name === 'workout') initial = '/library';
  }

  bootHistory(initial);
  render(<App />, document.getElementById('app')!);
  initPwa();
}

void boot();
