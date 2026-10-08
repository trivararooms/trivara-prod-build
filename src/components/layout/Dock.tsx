import { Link, useLocation } from 'react-router-dom';
import { Heart, Home, Plane, Search } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useSavedListingIds } from '@/hooks/useSavedListingIds';

// Floating bottom dock (Home / Explore / Trips / Saved with a live count).
// Hidden on routes that are working surfaces rather than browsing ones
// (login, admin and host tooling) so it never covers their controls.
const HIDDEN_PREFIXES = ['/login', '/admin', '/host/'];

export function Dock() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const savedIds = useSavedListingIds(user?.id);
  const savedCount = savedIds.data?.size ?? 0;

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const items = [
    { to: '/', label: 'Home', icon: Home, active: pathname === '/' },
    { to: '/search', label: 'Explore', icon: Search, active: pathname === '/search' },
    { to: '/trips', label: 'Trips', icon: Plane, active: pathname === '/trips' },
    { to: '/saved', label: 'Saved', icon: Heart, active: pathname === '/saved', badge: savedCount },
  ];

  return (
    <nav aria-label="Quick navigation" className="nu fixed bottom-[18px] left-1/2 z-40 flex -translate-x-1/2 gap-1 rounded-full p-2">
      {items.map(({ to, label, icon: Icon, active, badge }) => (
        <Link
          key={to}
          to={to}
          aria-current={active ? 'page' : undefined}
          className={`relative flex flex-col items-center gap-0.5 rounded-full px-[18px] py-2 font-ui text-[11px] font-bold transition-all duration-200 ${
            active ? 'bg-accent text-accent-foreground' : 'text-text-secondary hover:bg-accent hover:text-accent-foreground'
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2} />
          {label}
          {!!badge && (
            <em className="absolute right-2.5 top-0.5 rounded-full bg-accent px-1.5 text-[10px] font-extrabold not-italic text-accent-foreground ring-1 ring-background">
              {badge}
            </em>
          )}
        </Link>
      ))}
    </nav>
  );
}
