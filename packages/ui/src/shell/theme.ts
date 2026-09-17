/**
 * Theme preference.
 *
 * Stored in localStorage and applied as `data-theme` on the root element, which
 * `packages/config/tailwind/tokens.css` already understands. "system" removes
 * the attribute so `prefers-color-scheme` decides.
 *
 * A small, satisfying property of the micro-frontend setup: both applications
 * are served from ONE origin, so they share one localStorage. Choose dark mode
 * on a Platform page and the CPQ pages are dark too — with no coordination
 * between the apps beyond reading the same key.
 */

export const THEME_STORAGE_KEY = 'nexora.theme';

export type ThemePreference = 'system' | 'light' | 'dark';

export const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

/** Apply a preference to the document. Browser only. */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'system') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
}

/** Read the stored preference, tolerating blocked or cleared storage. */
export function readThemePreference(): ThemePreference {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable (private mode, blocked). The choice still applies
    // for this page view; it simply will not persist.
  }
}

/**
 * Inline script run before first paint, so a stored dark preference does not
 * flash light on load. A static string with no interpolated input — nothing
 * user-controlled is ever written into it.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;
