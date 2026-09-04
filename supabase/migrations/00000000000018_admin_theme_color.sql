-- =============================================================================
-- 00000000000018_admin_theme_color.sql
--
-- Seeds the app_settings row backing the admin-configurable site-wide
-- background/text theme (Admin Settings > Appearance, src/lib/theme.ts).
-- Unlike 00000000000016's `site_background_css` (a raw CSS `background`
-- value - solid color or gradient - painted over <body>), this key drives
-- the actual neutral CSS-variable scale src/index.css's `:root` block
-- defines (--background, --card, --popover, --surface-0..4, --border,
-- --text-primary/-secondary/-meta, --sidebar-background/-foreground) via
-- src/components/layout/ThemeColor.tsx, so every themed surface sitewide
-- (not just the page background) tracks the chosen color, and text color is
-- derived automatically for contrast instead of staying hardcoded near-white.
--
-- Defaults to a beige tone rather than the CSS's own hardcoded near-black,
-- since that's the admin-facing default the picker should start from.
--
-- update_app_setting() only UPDATEs an existing row (see
-- 00000000000001_consolidated_baseline.sql) - it never inserts one - so
-- this key has to be seeded here first, same as every other admin setting.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('appearance', 'theme_background_color', '#EDE4D3', false, 'Site-wide background color (hex). Text color is derived automatically for contrast.')
ON CONFLICT (key) DO NOTHING;
