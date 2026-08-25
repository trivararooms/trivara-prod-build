import { createContext, useContext } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { Profile } from '@/services/profileService';

// The context object and useAuth hook live here (rather than in
// AuthContext.tsx alongside the AuthProvider component) so that
// AuthContext.tsx only exports a component - having a component and a hook
// exported from the same file breaks Vite's fast-refresh isolation
// (react-refresh/only-export-components).

export interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
