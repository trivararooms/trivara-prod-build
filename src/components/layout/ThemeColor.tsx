import { useEffect } from 'react';
import { siteSettingsService } from '@/services/siteSettingsService';
import { applyTextContrast } from '@/lib/theme';

/**
 * Keeps text readable against the admin-configurable site background
 * (Admin Settings > Branding > "Site-wide background", the same
 * `site_background_css` setting SiteBackground.tsx paints onto the page) by
 * flipping --foreground and friends to near-black or near-white based on
 * that value. Renders nothing itself; mount once near the root alongside
 * <SiteBackground /> (see App.tsx).
 */
export function ThemeColor() {
  useEffect(() => {
    let cancelled = false;
    siteSettingsService.getSiteBackground().then((css) => {
      if (cancelled || !css) return;
      applyTextContrast(css);
    }).catch((error) => {
      console.error('Error loading site background for text contrast:', error);
    });
    return () => { cancelled = true; };
  }, []);

  return null;
}
