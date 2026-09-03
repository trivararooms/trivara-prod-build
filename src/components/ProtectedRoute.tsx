import { Navigate, useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

type Role = 'admin' | 'host' | 'ops_admin';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: Role;
  /** Allow any one of several roles (OR match) - use instead of requiredRole
   *  when more than one role should reach the page, e.g. admin + ops_admin. */
  allowRoles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, allowRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check for required role if specified. This used to silently redirect
  // home with no explanation - showing an actual warning page instead
  // makes it clear the page exists and was denied, rather than looking
  // like the link was just broken.
  const allowed = allowRoles ?? (requiredRole ? [requiredRole] : null);
  if (allowed && !allowed.includes(profile?.role as Role)) {
    console.warn(`Unauthorized access attempt to ${location.pathname}. Required role: ${allowed.join(' or ')}`);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-medium text-foreground">
            You don't have access to this page
          </h1>
          <p className="mb-6 text-text-secondary">
            This page requires {allowed.join(' or ')} access, and your account doesn't have it.
          </p>
          <Link to="/" className="text-accent underline hover:text-accent-hover">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
