import React, { useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../services/profileService';
import { AuthContext } from '@/hooks/useAuth';

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error fetching profile in AuthContext:', error);
      setProfile(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    // supabase-js coordinates token refresh across browser tabs using the
    // Web Locks API - if a previous tab/reload left that lock in a bad state
    // (crashed mid-refresh, a background tab throttled by the browser, some
    // private-browsing lock restrictions), auth.getSession() can hang
    // indefinitely instead of rejecting. Since every page in this app blocks
    // its own render on `loading` from this context, that hang was surfacing
    // as "stuck on the loading spinner forever" on reload/back-navigation/
    // direct links - not just on one page, but on every page, because they
    // all wait on the same stuck promise. Race it against a timeout so
    // `loading` always resolves either way; onAuthStateChange below is a
    // separate, independent subscription and will still correct `user`/
    // `session`/`profile` on its own once the real auth state comes through,
    // even if this race timed out first.
    const SESSION_TIMEOUT_MS = 8000;
    const timedOut = Symbol('auth-session-timeout');

    const getInitialSession = async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<typeof timedOut>((resolve) =>
            setTimeout(() => resolve(timedOut), SESSION_TIMEOUT_MS)
          ),
        ]);

        if (result === timedOut) {
          console.warn(
            `supabase.auth.getSession() did not resolve within ${SESSION_TIMEOUT_MS}ms - ` +
            'proceeding as logged-out for now; onAuthStateChange will correct this if a ' +
            'session actually exists.'
          );
          if (mounted) {
            setSession(null);
            setUser(null);
            setProfile(null);
          }
          return;
        }

        const { data: { session }, error } = result;
        if (error) throw error;

        if (mounted) {
          setSession(session);
          setUser(session?.user || null);
        }

        if (session?.user && mounted) {
          await fetchProfile(session.user.id);
        } else if (mounted) {
          setProfile(null);
        }
      } catch (err: unknown) {
        if (!(err instanceof Error) || err.name !== 'AbortError') {
          console.error('Error during AuthContext initialization:', err);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getInitialSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      setSession(session);
      setUser(session?.user || null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }

      if (mounted) {
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const value = {
    user,
    profile,
    session,
    loading,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
