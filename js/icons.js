// icons.js — a tiny inline Lucide (ISC-licensed) icon set. The guiding rule: actions get icons,
// scientific meaning stays in words. No dependency — the SVG source is copied inline. Every icon is
// decorative (aria-hidden): the control's visible text or aria-label carries the accessible name.
// Stroke 1.5 + currentColor so the glyphs read as one thin, theme-aware, forced-colors-safe system.

const BODIES = {
  sun:
    '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/>' +
    '<path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/>' +
    '<path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  moon: '<path d="M12 3a6.4 6.4 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  move:
    '<polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/>' +
    '<polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/>' +
    '<line x1="2" x2="22" y1="12" y2="12"/><line x1="12" x2="12" y1="2" y2="22"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  'arrow-up-right': '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  // A targeting reticle — reads as "read at this point", unlike the old bare "+".
  crosshair:
    '<circle cx="12" cy="12" r="10"/><line x1="22" x2="18" y1="12" y2="12"/>' +
    '<line x1="6" x2="2" y1="12" y2="12"/><line x1="12" x2="12" y1="6" y2="2"/>' +
    '<line x1="12" x2="12" y1="22" y2="18"/>',
};

// Return the inline SVG markup for a named icon (empty string for an unknown name, so a failed
// lookup degrades to the control's text/label rather than throwing).
export function icon(name) {
  const body = BODIES[name];
  if (!body) return '';
  return (
    '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
  );
}
