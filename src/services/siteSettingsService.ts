import { supabase } from '@/lib/supabase';

// Thin wrapper around the app_settings-backed RPCs (see
// 00000000000001_consolidated_baseline.sql) for the one setting the public
// homepage itself needs to read: the hero background image. Everything else
// admin-configurable stays inlined in AdminSettings.tsx since nothing else
// reads it from outside that page.
export const siteSettingsService = {
  /** Public read - null means "use the default CSS gradient". */
  async getHeroBackgroundImageUrl(): Promise<string | null> {
    const { data, error } = await supabase.rpc('get_app_setting', { p_key: 'hero_background_image_url' });
    if (error) {
      console.error('Error fetching hero background image setting:', error);
      return null;
    }
    return (data as string | null) || null;
  },

  /** Admin-only (enforced by the site-assets storage policy + update_app_setting RPC). */
  async uploadHeroBackgroundImage(file: File): Promise<string> {
    const path = `hero/${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage
      .from('site-assets')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage.from('site-assets').getPublicUrl(data.path);

    const { error: settingError } = await supabase.rpc('update_app_setting', {
      p_key: 'hero_background_image_url',
      p_value: publicUrl,
    });
    if (settingError) throw settingError;

    return publicUrl;
  },
};
