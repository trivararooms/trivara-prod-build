import { useEffect, useState } from 'react';
import { siteSettingsService } from '@/services/siteSettingsService';
import { applyTextContrast, clearTextContrast } from '@/lib/theme';
import { getStoredTheme, THEME_CHANGE_EVENT, ThemeId } from '@/lib/themes';

/**
 * Keeps text readable against the admin-configurable site background
 * (Admin Settings > Branding > "Site-wide background", the same
 * `site_background_css` setting SiteBackground.tsx paints onto the page) by
 * flipping --foreground and friends to near-black or near-white based on
 * that value. Only active under the "paper" colour scheme, same as
 * SiteBackground - every other scheme ships its own readable text colours.
 * Renders nothing itself; mount once near the root alongside
 * <SiteBackground /> (see App.tsx).
 */
export function ThemeColor() {
  const [theme, setTheme] = useState<ThemeId>(() => getStoredTheme());

  useEffect(() => {
    const onChange = (e: Event) => setTheme((e as CustomEvent<ThemeId>).detail);
    window.addEventListener(THEME_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (theme !== 'paper') {
      clearTextContrast();
      return;
    }

    siteSettingsService.getSiteBackground().then((css) => {
      if (cancelled || !css) return;
      applyTextContrast(css);
    }).catch((error) => {
      console.error('Error loading site background for text contrast:', error);
    });
    return () => { cancelled = true; };
  }, [theme]);

  return null;
}
