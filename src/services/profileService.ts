import { supabase } from '@/lib/supabase';

/**
 * True for Supabase/PostgREST errors that just mean "no profile visible to
 * this caller" (RLS denied it, or `.single()` found zero/multiple rows)
 * rather than a real failure worth surfacing as an error.
 */
function isExpectedProfileFetchError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (['401', '403', '406', 'PGRST116'].includes(error.code || '')) return true;
  const message = error.message || '';
  return message.includes('permission') || message.includes('coerce the result to a single JSON object');
}

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
  role: 'guest' | 'host' | 'admin';
  is_host: boolean;
  bio?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export class ProfileService {
  async getByUserId(userId: string): Promise<Profile | null> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        if (isExpectedProfileFetchError(error)) {
          console.debug('Expected profile fetch error (likely profile not found or access denied):', error);
          return null;
        }
        console.error('Unexpected error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error: unknown) {
      console.error('Unexpected error fetching profile:', error);
      return null;
    }
  }

  /**
   * Updates the caller's own editable profile fields. Restricted to exactly
   * the columns the `profiles` UPDATE grant permits for `authenticated`
   * (first_name, last_name, phone, avatar_url, bio) - see baseline migration
   * section 14; anything else (role, is_host, is_verified) is intentionally
   * unreachable from here.
   */
  async updateOwnProfile(
    userId: string,
    updates: { first_name?: string; last_name?: string; phone?: string; avatar_url?: string; bio?: string }
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  async updateRole(userId: string, role: 'guest' | 'host' | 'admin'): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId);

    if (error) {
      console.error('Error updating profile role:', error);
      return false;
    }

    return true;
  }

  async setIsHost(userId: string, isHost: boolean): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ 
        is_host: isHost,
        role: isHost ? 'host' : 'guest',
        updated_at: new Date().toISOString() 
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating is_host status:', error);
      return false;
    }

    return true;
  }

  async createProfile(userData: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    avatar_url?: string;
  }): Promise<Profile | null> {
    const { data, error } = await supabase
      .from('profiles')
      .insert([{
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name,
        avatar_url: userData.avatar_url,
        role: 'guest',
        is_host: false,
        is_verified: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating profile:', error);
      return null;
    }

    return data;
  }
}

export const profileService = new ProfileService();