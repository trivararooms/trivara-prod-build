import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center border border-border rounded-xl px-12 py-16">
        <h1 className="mb-2 text-6xl font-pillar font-bold text-accent">404</h1>
        <p className="font-script text-2xl text-text-secondary mb-4">lost the trail</p>
        <p className="mb-6 text-text-secondary">Oops! Page not found</p>
        <Link to="/" className="text-primary underline hover:text-primary/90">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
