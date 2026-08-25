import React, { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { isAdminEmail } from '@/lib/adminAccess';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/account';

  useEffect(() => {
    const checkAuthState = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Check if user is admin and redirect accordingly
        const userEmail = session.user.email;
        if (isAdminEmail(userEmail)) {
          // Check if user has admin role in profiles table
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('role')
            .eq('email', userEmail)
            .single();

          if (!error && profileData?.role === 'admin') {
            navigate('/admin/dashboard');
            return;
          }
        }
        navigate(from);
      }
    };

    checkAuthState();
  }, [navigate, from]);

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