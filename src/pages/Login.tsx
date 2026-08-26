import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/hooks/useAuth';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, loading: authLoading } = useAuth();

  const from = location.state?.from?.pathname || '/account';

  // Redirect away from the login page reactively, once AuthContext resolves
  // to a logged-in user - not as a one-shot check on mount. The previous
  // version ran its own separate supabase.auth.getSession() call exactly
  // once when this component mounted, and only navigated away if that one
  // call happened to already see a session. If the session wasn't
  // established yet at that exact instant - e.g. right after landing back
  // from the Google OAuth redirect, or while AuthContext's own
  // getSession()/onAuthStateChange handling was still in flight - the check
  // found nothing, did nothing, and (having an empty-ish dependency array)
  // never re-ran. The user would then sit on the login page even though
  // they were, or were about to be, actually authenticated, and the next
  // protected link they clicked would bounce them back to /login again -
  // reported as "goes to signup/login again and again". Depending on
  // `user`/`profile`/`authLoading` (AuthContext's own reactive state, the
  // same single source of truth ProtectedRoute uses) instead of a private
  // one-shot query fixes that, and also drops the duplicate admin-role
  // lookup this used to run separately from AuthContext's own profile fetch.
  useEffect(() => {
    if (authLoading || !user) return;
    if (profile?.role === 'admin') {
      navigate('/admin/dashboard', { replace: true });
    } else {
      navigate(from, { replace: true });
    }
  }, [authLoading, user, profile, from, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      // For admin users, we need to handle the redirect after OAuth callback
      // We'll set up a temporary storage to remember that this is an admin login attempt
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/` 
        }
      });

      if (error) {
        console.error('Google sign in error:', error);
      }
    } catch (err) {
      console.error('Sign in error:', err);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#2F3A4A] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-[#FAFAFA] tracking-wide mb-2">
            Sign in to Trivara
          </h1>
          <p className="text-sm text-[#B1B1B6] tracking-wide">
            Sign in to list your place or complete a booking.
          </p>
        </div>

        <button
          onClick={handleGoogleSignIn}
          className="w-full py-3 px-4 bg-[#FAFAFA] text-[#2F3A4A] font-medium rounded-lg hover:bg-[#B1B1B6] transition-colors duration-200 text-base tracking-wide"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
};

export default Login;