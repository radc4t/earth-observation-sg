// state.js — a tiny central store for app state.
//
// A single object describes "what is on screen now": the active section, the chosen
// basemap, which overlays are visible, and the reduced-motion preference. UI code sets
// state via setState() (which notifies subscribers) and reads state directly. This keeps
// cross-cutting concerns (e.g. the inspect tool needing to know which overlays are active)
// out of the individual modules, and gives future features (time slider, compare mode) a
// place to live without threading props through everything.

export const state = {
  section: null,
  basemap: 'sentinel2',
  overlays: { ndvi: false, thermal: false, maritime: false },
  reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
};

const subscribers = new Set();

export function setState(patch) {
  Object.assign(state, patch);
  subscribers.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

// Keep reduced-motion live if the user changes their OS setting mid-session.
window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
  setState({ reducedMotion: e.matches });
});
