import { Navigate, useLocation, Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'host';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#2F3A4A]">
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
  if (requiredRole && profile?.role !== requiredRole) {
    console.warn(`Unauthorized access attempt to ${location.pathname}. Required role: ${requiredRole}`);
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-2xl font-medium text-foreground">
            You don't have access to this page
          </h1>
          <p className="mb-6 text-text-secondary">
            This page requires {requiredRole} access, and your account doesn't have it.
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
