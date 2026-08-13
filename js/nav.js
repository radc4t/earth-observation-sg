// nav.js — the chapter-navigation rail + scroll-progress bar.
//
// Two orientation aids over the fixed map, both driven by state the story engine ALREADY
// publishes — this module owns no scroll observer of its own:
//   - a vertical rail of dots (one per SECTIONS entry) that shows which chapter is active and
//     lets the reader jump to any chapter; and
//   - a thin top bar that fills with overall scroll progress.
// Clicking a dot smooth-scrolls the matching .step into view; the existing IntersectionObserver
// in scrolly.js then reacts and flies the camera — so the nav adds no map/camera logic.

import { state, subscribe } from './state.js';
import { reduced } from './motion.js';

// Pure: fraction (0..1) of the page scrolled. Exported for unit testing; guards an unscrollable
// page (content shorter than the viewport) so it never divides by zero or reports NaN, and clamps
// so momentum/rubber-band overscroll can't push it outside [0, 1].
export function scrollProgress(scrollY, scrollHeight, innerHeight) {
  const scrollable = scrollHeight - innerHeight;
  if (scrollable <= 0) return 0;
  return Math.min(1, Math.max(0, scrollY / scrollable));
}

export function initNav(sections) {
  const rail = document.getElementById('chapter-nav');
  const progress = document.getElementById('scroll-progress');
  const fill = progress ? progress.querySelector('span') : null;
  const homeId = sections.length ? sections[0].id : null;

  // --- Chapter rail -----------------------------------------------------------------------
  const dots = new Map(); // section id -> button
  if (rail) {
    sections.forEach((s) => {
      const label = s.nav || s.id;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chapter-nav-dot';
      btn.dataset.id = s.id;
      btn.setAttribute('aria-label', label); // accessible name (the visible label is decorative)
      btn.innerHTML =
        `<span class="chapter-nav-label" aria-hidden="true">${label}</span>` +
        '<span class="chapter-nav-mark" aria-hidden="true"></span>';
      // Jump to a chapter: scroll its step into view and let scrolly.js's observer drive the
      // camera. Instant under reduced motion.
      btn.addEventListener('click', () => {
        const step = document.querySelector(`.step[data-id="${s.id}"]`);
        if (step) step.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      });
      rail.appendChild(btn);
      dots.set(s.id, btn);
    });
  }

  // Highlight the active dot from state.section (published by scrolly.js on every activation).
  const setActive = (id) => {
    dots.forEach((btn, key) => {
      const on = key === id;
      btn.classList.toggle('is-active', on);
      if (on) btn.setAttribute('aria-current', 'true');
      else btn.removeAttribute('aria-current');
    });
  };

  // Mirror the active chapter into the URL hash for shareable deep-links — replaceState so it
  // neither pollutes history nor triggers the load-time jumpTo in app.js. The first chapter keeps
  // a clean URL (no hash). Only ever runs from the subscription below, i.e. AFTER load-time
  // deep-linking has consumed location.hash — the initial setActive() never writes the hash.
  const syncHash = (id) => {
    if (id === homeId) {
      if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    } else if (id && location.hash.slice(1) !== id) {
      history.replaceState(null, '', `#${id}`);
    }
  };

  setActive(state.section); // initial sync only — no hash write (see syncHash note)
  subscribe((s) => {
    setActive(s.section);
    syncHash(s.section);
  });

  // --- Scroll-progress bar ----------------------------------------------------------------
  if (fill) {
    let ticking = false;
    const paint = () => {
      ticking = false;
      const p = scrollProgress(
        window.scrollY,
        document.documentElement.scrollHeight,
        window.innerHeight
      );
      fill.style.transform = `scaleX(${p})`;
    };
    const onScroll = () => {
      if (ticking) return; // coalesce bursts of scroll events into one paint per frame
      ticking = true;
      requestAnimationFrame(paint);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    paint(); // initial fill
  }
}
