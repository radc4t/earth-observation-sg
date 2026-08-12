// theme.js — manual light/dark override on top of the CSS prefers-color-scheme default.
//
// The CSS cascade themes the page from the OS preference *unless* documentElement carries a
// data-theme attribute. So we set data-theme only when the user explicitly chooses, and
// persist that choice — which makes an explicit choice win over the OS and survive reloads.
// A tiny inline <head> script in index.html applies the stored choice before first paint to
// avoid a flash of the system theme (FOUC); this module owns everything after that.

const KEY = 'eo-theme'; // 'light' | 'dark' | absent (follow the system preference)

export function storedTheme() {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage can throw in private mode
  }
}

function systemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// The theme in force right now: the explicit choice if any, else the OS preference.
export function currentTheme() {
  return storedTheme() || systemTheme();
}

function apply(theme) {
  if (theme) document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

export function setTheme(theme) {
  try {
    if (theme) localStorage.setItem(KEY, theme);
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore storage failures (private mode) */
  }
  apply(theme);
  return theme;
}

export function toggleTheme() {
  return setTheme(currentTheme() === 'dark' ? 'light' : 'dark');
}

// Wire a button that flips the theme and reflects the current state.
export function registerThemeToggle(button) {
  if (!button) return;
  const sync = () => {
    const isDark = currentTheme() === 'dark';
    button.setAttribute('aria-pressed', String(isDark));
    button.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    button.textContent = isDark ? '☀' : '☾'; // shows the current theme; label states the action
  };
  sync();
  button.addEventListener('click', () => {
    toggleTheme();
    sync();
  });
  // With no explicit choice, keep the button glyph in step with live OS changes.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!storedTheme()) sync();
  });
}
