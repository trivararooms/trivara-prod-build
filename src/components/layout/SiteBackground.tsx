import { useEffect, useState } from 'react';
import { siteSettingsService } from '@/services/siteSettingsService';
import { getStoredTheme, THEME_CHANGE_EVENT, ThemeId } from '@/lib/themes';

const STYLE_TAG_ID = 'site-background-override';

/**
 * Applies the admin-configurable site-wide background (a raw CSS
 * `background` value - solid color or gradient, see AdminSettings >
 * Branding) everywhere. Setting it only on <body> used to show through
 * only where nothing sat on top of it - which in practice was just the
 * strip behind the transparent header, since almost every page's own root
 * wrapper (`<div className="min-h-screen bg-background">`) paints its own
 * opaque background right over <body>. Injecting a `!important` rule
 * targeting the `.bg-background` utility class itself overrides every one
 * of those wrappers directly - no per-page edits needed, since they all
 * already use that same class. Renders nothing itself; mount once near the
 * root (see App.tsx).
 *
 * The visitor-selectable colour schemes (src/lib/themes.ts) own the page
 * background, so this admin override only applies while the "paper" scheme
 * (the brand's original warm canvas) is active - otherwise it would paint a
 * custom backdrop under a scheme whose text colours it knows nothing about.
 */
export function SiteBackground() {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    const onChange = (e: Event) => setTheme((e as CustomEvent<ThemeId>).detail);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const existing = document.getElementById(STYLE_TAG_ID);

    if (theme !== 'paper') {
      existing?.remove();
      return;
    }

    siteSettingsService.getSiteBackground().then((css) => {
      if (cancelled || !css) return;

      let styleEl = document.getElementById(STYLE_TAG_ID) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = STYLE_TAG_ID;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        body, .bg-background {
          background: ${css} !important;
          background-attachment: fixed;
          background-size: cover;
        }
      `;
    }).catch((error) => {
      console.error('Error loading site background setting:', error);
    });
    return () => { cancelled = true; };
  }, [theme]);

  return null;
}
