-- =============================================================================
-- 00000000000017_background_overlay_opacity.sql
--
-- Seeds the app_settings rows controlling how dark the tint is over the
-- hero and "Become a Host" background images (Admin Settings > Branding).
-- Stored as a 0-100 integer (percent opacity of the dark wash), defaulting
-- to what the code already hardcoded before this setting existed - see
-- src/pages/Index.tsx.
--
-- update_app_setting() only UPDATEs an existing row (see
-- 00000000000001_consolidated_baseline.sql), so these have to be seeded
-- here first, same as every other Branding setting.
--
-- Safe to re-run: ON CONFLICT DO NOTHING.
-- =============================================================================

INSERT INTO public.app_settings (category, key, value, is_secret, description) VALUES
  ('homepage', 'hero_overlay_opacity', '65', false, 'Darkness of the tint over the hero background image (0-100)'),
  ('homepage', 'host_cta_overlay_opacity', '80', false, 'Darkness of the tint over the "Become a Host" background image (0-100)')
ON CONFLICT (key) DO NOTHING;
