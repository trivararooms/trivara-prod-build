import { describe, it, expect, beforeEach, vi } from 'vitest';
import { THEMES, DEFAULT_THEME, THEME_STORAGE_KEY, isThemeId, getStoredTheme, applyTheme } from './themes';

// The suite runs in the plain node environment (no jsdom), so the few browser
// globals themes.ts touches are stubbed by hand.
function installBrowserStubs() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
  const dataset: Record<string, string> = {};
  vi.stubGlobal('document', { documentElement: { dataset } });
  const dispatchEvent = vi.fn();
  vi.stubGlobal('window', { dispatchEvent });
  return { dataset, dispatchEvent };
}

describe('themes', () => {
  let stubs: ReturnType<typeof installBrowserStubs>;

  beforeEach(() => {
    stubs = installBrowserStubs();
  });

  it('exposes the five schemes', () => {
    expect(THEMES.map((t) => t.id)).toEqual(['paper', 'chalk', 'obsidian', 'forest', 'ocean']);
  });

  it('validates ids', () => {
    expect(isThemeId('forest')).toBe(true);
    expect(isThemeId('neon')).toBe(false);
  });

  it('falls back to the default when nothing (or junk) is stored', () => {
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
    localStorage.setItem(THEME_STORAGE_KEY, 'nope');
    expect(getStoredTheme()).toBe(DEFAULT_THEME);
  });

  it('applies, persists and announces a theme', () => {
    applyTheme('ocean');
    expect(stubs.dataset.theme).toBe('ocean');
    expect(getStoredTheme()).toBe('ocean');
    expect(stubs.dispatchEvent).toHaveBeenCalledTimes(1);
  });
});
