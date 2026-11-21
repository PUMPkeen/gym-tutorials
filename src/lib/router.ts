import { useEffect, useState } from 'preact/hooks';

// Hash routes (eng review R1): an installed app on Android closes when the back
// gesture finds no history entry, so every screen is a history entry.
//
//   #/library  ->  #/add | #/edit/<id> | #/workout | #/settings
//   back = previous screen; history.state.depth counts in-app entries so that
//   goBack() never leaves the app when there is nothing behind us.

export type Route =
  | { name: 'library' }
  | { name: 'add' }
  | { name: 'edit'; id: string }
  | { name: 'workout' }
  | { name: 'settings' };

export function parseHash(hash: string): Route {
  const path = hash.replace(/^#/, '');
  const edit = /^\/edit\/([^/]+)$/.exec(path);
  if (edit) return { name: 'edit', id: decodeURIComponent(edit[1]) };
  switch (path) {
    case '/add':
      return { name: 'add' };
    case '/workout':
      return { name: 'workout' };
    case '/settings':
      return { name: 'settings' };
    default:
      return { name: 'library' };
  }
}

const EVENT = 'app:navigate';

function depth(): number {
  return (history.state as { depth?: number } | null)?.depth ?? 0;
}

function notify() {
  window.dispatchEvent(new Event(EVENT));
}

export function navigate(path: string) {
  history.pushState({ depth: depth() + 1 }, '', `#${path}`);
  notify();
}

export function replaceRoute(path: string) {
  history.replaceState({ depth: depth() }, '', `#${path}`);
  notify();
}

/** Back one screen inside the app; if this is the first entry, replace with `fallback`. */
export function goBack(fallback = '/library') {
  if (depth() > 0) history.back();
  else replaceRoute(fallback);
}

/**
 * On launch, make sure Library sits underneath whatever screen we open, so the
 * back gesture lands on Library instead of closing the app.
 */
export function bootHistory(initialPath?: string) {
  const current = parseHash(location.hash);
  const target = initialPath ?? (current.name === 'library' ? undefined : location.hash.replace(/^#/, ''));
  history.replaceState({ depth: 0 }, '', '#/library');
  if (target && target !== '/library') history.pushState({ depth: 1 }, '', `#${target}`);
  notify();
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(location.hash));
  useEffect(() => {
    const update = () => setRoute(parseHash(location.hash));
    window.addEventListener('popstate', update);
    window.addEventListener('hashchange', update);
    window.addEventListener(EVENT, update);
    return () => {
      window.removeEventListener('popstate', update);
      window.removeEventListener('hashchange', update);
      window.removeEventListener(EVENT, update);
    };
  }, []);
  return route;
}
