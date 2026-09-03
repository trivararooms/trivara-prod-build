import { useEffect } from 'react';
import { siteSettingsService } from '@/services/siteSettingsService';

/**
 * Applies the admin-configurable site-wide background (a raw CSS
 * `background` value - solid color or gradient, see AdminSettings >
 * Branding) directly to <body>. An inline style wins over the `bg-
 * background` utility class index.css already puts on <body>, so this is
 * the one place that needs to touch the DOM - no per-page changes. Renders
 * nothing itself; mount once near the root (see App.tsx).
 */
export function SiteBackground() {
  useEffect(() => {
    let cancelled = false;
    siteSettingsService.getSiteBackground().then((css) => {
      if (cancelled || !css) return;
      document.body.style.background = css;
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundSize = 'cover';
    }).catch((error) => {
      console.error('Error loading site background setting:', error);
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
