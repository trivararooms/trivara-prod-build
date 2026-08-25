// Shared admin-access check, used as defense-in-depth on top of RLS and the
// `role = 'admin'` check enforced by ProtectedRoute/the database. This used
// to be copy-pasted (with the email hardcoded twice) in both Login.tsx and
// AdminDashboard.tsx; centralizing it means there is one place to rotate the
// admin email or move it to configuration.
//
// NOTE: the real access control lives in Postgres RLS policies and the
// `is_admin()` function (see supabase/migrations) - this check only affects
// client-side navigation/redirect behavior. Removing or bypassing it cannot
// grant access to anything the database wouldn't already grant.
export const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'trivararooms@gmail.com';

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && email === ADMIN_EMAIL;
}
