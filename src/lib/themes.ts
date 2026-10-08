// Five switchable colour schemes. The actual token values live in
// src/index.css as html[data-theme="..."] blocks; this file only knows the
// ids, labels and the two swatch colours the switcher draws, plus the tiny
// storage/apply helpers shared by the switcher and index.html's pre-paint
// script (keep THEME_STORAGE_KEY and DEFAULT_THEME in sync with that script).

export type ThemeId = 'paper' | 'chalk' | 'obsidian' | 'forest' | 'ocean';

export interface ThemeOption {
  id: ThemeId;
  name: string;
  swatch: [string, string];
}

export const THEMES: ThemeOption[] = [
  { id: 'paper', name: 'Paper', swatch: ['#F6F1E7', '#F9B312'] },
  { id: 'chalk', name: 'Chalk', swatch: ['#FFFFFF', '#E8412C'] },
  { id: 'obsidian', name: 'Obsidian', swatch: ['#09090B', '#FFB020'] },
  { id: 'forest', name: 'Forest', swatch: ['#0E1912', '#C8E86B'] },
  { id: 'ocean', name: 'Ocean', swatch: ['#E9F0F7', '#1E5BFF'] },
];

export const THEME_STORAGE_KEY = 'tv-theme';
export const DEFAULT_THEME: ThemeId = 'obsidian';
export const THEME_CHANGE_EVENT = 'tv-themechange';

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

export function getStoredTheme(): ThemeId {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(id: ThemeId): void {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // private mode / blocked storage - the choice just won't persist.
  }
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: id }));
}
