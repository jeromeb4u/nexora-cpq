'use client';

import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import {
  type ThemePreference,
  THEME_PREFERENCES,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  writeThemePreference,
} from '@nexora/ui';

import { cn } from './cn';

const OPTIONS: Record<ThemePreference, { readonly label: string; readonly icon: typeof Sun }> = {
  system: { label: 'System', icon: Monitor },
  light: { label: 'Light', icon: Sun },
  dark: { label: 'Dark', icon: Moon },
};

/** Same-tab writes do not fire `storage`, so they announce themselves. */
const SAME_TAB_EVENT = 'nexora:theme-change';

/**
 * localStorage is an external store, so it is read with `useSyncExternalStore`
 * rather than copied into state from an effect.
 *
 * That gets three things right at once: a stable server snapshot ("system")
 * so hydration never mismatches, no extra render cascade, and live updates — if
 * the theme is changed in another tab, including a CPQ page on the same origin,
 * this control follows it.
 */
function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(SAME_TAB_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(SAME_TAB_EVENT, onChange);
  };
}

const getServerSnapshot = (): ThemePreference => 'system';

export function ThemePreferenceControl() {
  const preference = useSyncExternalStore(subscribe, readThemePreference, getServerSnapshot);

  function choose(next: ThemePreference) {
    writeThemePreference(next);
    applyTheme(next);
    window.dispatchEvent(new Event(SAME_TAB_EVENT));
  }

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-3 gap-2">
      {THEME_PREFERENCES.map((option) => {
        const { label, icon: Icon } = OPTIONS[option];
        const active = option === preference;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => choose(option)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-sm transition-colors',
              active
                ? 'border-[var(--accent-border)] bg-[var(--surface-selected)] font-medium text-[var(--text-link)]'
                : 'border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
