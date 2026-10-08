import { useEffect } from 'react';
import { siteSettingsService } from '@/services/siteSettingsService';

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
 */
export function SiteBackground() {
  useEffect(() => {
    let cancelled = false;
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
  }, []);

  return null;
}
