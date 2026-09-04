import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { applyThemeColor } from '@/lib/theme';

/**
 * Applies the admin-configurable site-wide background/text theme (Admin
 * Settings > Appearance) at startup, by fetching `theme_background_color`
 * from app_settings and writing the derived HSL values onto :root (see
 * src/lib/theme.ts). Falls back silently to the hardcoded dark default in
 * src/index.css - i.e. does nothing - if the fetch errors or the row
 * hasn't been seeded yet (supabase/migrations/00000000000018_admin_theme_color.sql).
 * Renders nothing itself; mount once near the root (see App.tsx).
 */
export function ThemeColor() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', 'theme_background_color')
          .single();

        if (cancelled || error || !data?.value) return;
        applyThemeColor(data.value);
      } catch (error) {
        console.error('Error loading theme color setting:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
