// motion.js — the shared motion vocabulary.
//
// One small, deliberate set of timing + easing constants so the story's transitions share a
// rhythm instead of each component inventing its own duration. This is a vocabulary, NOT an
// animation framework — keep it tiny.
//
// SINGLE SOURCE OF TRUTH for JS-driven timings. The CSS custom properties in css/style.css
// (:root, "motion vocabulary" block) MIRROR these values by hand; each side carries a comment
// pointing at the other. If you change a value here, change it there too.
//
// Note: `easeLinearity` is Leaflet's flyTo easing parameter — a different easing model from the
// CSS cubic-beziers, so it is *coordinated with*, not identical to, --ease-standard/--ease-ground.

export const MOTION = {
  durMicro: 120, // hover / press / focus / toggle            (--dur-micro)
  durComponent: 260, // card reveal, legend fade, inspector sheet   (--dur-component)
  durPanel: 520, // ground / overlay cross-fade, paper wash     (--dur-panel)
  delayNarrative: 260, // evidence -> interpretation beat             (--delay-narrative)
  easeStandard: 'cubic-bezier(0.22, 1, 0.36, 1)', // UI arrival        (--ease-standard)
  easeGround: 'cubic-bezier(0.4, 0, 0.2, 1)', // symmetric fades    (--ease-ground)
  easeLinearity: 0.3, // Leaflet flyTo easing — higher = snappier glide, shorter soft tail (M7 dial).
};

// Build a CSS transition string for a single property from the tokens above, e.g.
// cssTransition('opacity', MOTION.durPanel, MOTION.easeGround) -> "opacity 520ms cubic-bezier(...)".
export function cssTransition(prop, durationMs, easing = MOTION.easeStandard) {
  return `${prop} ${durationMs}ms ${easing}`;
}

// Shared reduced-motion check (several modules need it; keep the query string in one place).
export function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
