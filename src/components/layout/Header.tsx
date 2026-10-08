import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, Home, MessageCircle, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useAuth } from '@/hooks/useAuth';
import { messageService } from '@/services/messageService';
import { Logo } from '@/components/layout/Logo';
import { ThemeSwitcher } from '@/components/layout/ThemeSwitcher';

// Rendered exactly once, in App.tsx, above every route. A floating glass
// pill (logo, links, colour-scheme dots, Host CTA) that sits in the same
// sticky 5rem band on every page - so nothing underneath is ever covered or
// unclickable (the home hero pulls itself up under this band with -mt-20).
// The pill itself is pointer-events-auto; the empty band around it is not,
// so it never intercepts clicks meant for the page.
const linkClass = 'rounded-full px-4 py-2 font-ui text-[13px] font-semibold text-foreground/70 transition-all duration-200 hover:bg-foreground/10 hover:text-foreground';

export function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';
  // AuthContext already fetches this user's own profile row (role, is_host)
  // once on login - reading it here instead of doing a second, separate
  // profileService.getByUserId() fetch on every single page (Header renders
  // everywhere) avoids a redundant network round-trip and a second source of
  // truth that could drift out of sync with the one AuthContext already has.
  const { user, profile, signOut } = useAuth();
  const isHost = profile?.is_host ?? false;
  const isAdmin = profile?.role === 'admin';
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user?.id) {
      setUnreadMessages(0);
      return;
    }
    let cancelled = false;
    messageService.getUnreadCount(user.id).then((count) => {
      if (!cancelled) setUnreadMessages(count);
    }).catch((error) => {
      console.error('Error loading unread message count:', error);
    });
    return () => { cancelled = true; };
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="pointer-events-none sticky top-0 z-30 flex h-20 w-full items-center justify-center px-3">
      <nav
        aria-label="Main"
        className="glass pointer-events-auto flex w-full max-w-[1040px] animate-fade-in items-center gap-1 rounded-full py-2 pl-5 pr-2.5"
      >
        <Link to="/" className="mr-auto flex items-center gap-2" aria-label="Trivara home">
          <Logo markClassName="h-8 w-8" nameClassName="text-base !tracking-[0.12em]" />
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-0.5 md:flex">
          {isHome && <a href="#featured" className={linkClass}>Featured</a>}
          {isHome ? <a href="#explore" className={linkClass}>Explore</a> : <Link to="/search" className={linkClass}>Explore</Link>}
          {user && <Link to="/trips" className={linkClass}>Trips</Link>}
          {user && <Link to="/saved" className={linkClass}>Saved</Link>}

          {user && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Messages"
              className="relative h-9 w-9 rounded-full text-foreground/70 hover:bg-foreground/10 hover:text-foreground"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="h-[18px] w-[18px]" />
              {unreadMessages > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-ui text-[10px] font-bold text-accent-foreground">
                  {unreadMessages}
                </span>
              )}
            </Button>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={`${linkClass} flex items-center gap-1`}>
                  Account <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="glass min-w-[200px] rounded-2xl p-1.5">
                <DropdownMenuItem className="rounded-xl" onSelect={() => navigate('/account')}>Account settings</DropdownMenuItem>
                {isHost && <DropdownMenuItem className="rounded-xl" onSelect={() => navigate('/host/dashboard')}>Host dashboard</DropdownMenuItem>}
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="rounded-xl" onSelect={() => navigate('/admin/dashboard')}>Admin dashboard</DropdownMenuItem>
                    <DropdownMenuItem className="rounded-xl" onSelect={() => navigate('/admin/dashboard/settings')}>Admin settings</DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem className="rounded-xl" onSelect={handleLogout}>Logout</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button type="button" className={linkClass} onClick={() => navigate('/login')}>Login</button>
          )}
        </div>

        <ThemeSwitcher className="mx-2.5 hidden sm:flex" />

        {!isHost && (
          <Link
            to="/host"
            className="hidden rounded-full bg-accent px-5 py-2.5 font-ui text-[13px] font-bold text-accent-foreground transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-8px_var(--glow)] sm:inline-flex"
          >
            Host
          </Link>
        )}

        {/* Mobile menu - the one menu below the md breakpoint. */}
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open menu" className="rounded-full md:hidden">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-80 border-border bg-surface-0">
            <div className="mt-8 flex flex-col gap-6">
              <ThemeSwitcher />
              {user ? (
                <>
                  {!isHost && (
                    <SheetClose asChild>
                      <Link to="/host" className="flex items-center gap-3 text-lg">
                        <Home className="h-5 w-5" />
                        Become a Host
                      </Link>
                    </SheetClose>
                  )}
                  <SheetClose asChild><Link to="/search" className="text-lg">Explore</Link></SheetClose>
                  <SheetClose asChild><Link to="/trips" className="text-lg">Your Trips</Link></SheetClose>
                  <SheetClose asChild><Link to="/saved" className="text-lg">Saved</Link></SheetClose>
                  <SheetClose asChild><Link to="/account" className="text-lg">Account Settings</Link></SheetClose>
                  <SheetClose asChild>
                    <Link to="/messages" className="flex items-center gap-3 text-lg">
                      <MessageCircle className="h-5 w-5" />
                      Messages
                      {unreadMessages > 0 && (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-medium text-accent-foreground">
                          {unreadMessages}
                        </span>
                      )}
                    </Link>
                  </SheetClose>
                  {isAdmin && (
                    <>
                      <SheetClose asChild><Link to="/admin/dashboard" className="text-lg">Admin Dashboard</Link></SheetClose>
                      <SheetClose asChild><Link to="/admin/dashboard/settings" className="text-lg">Admin Settings</Link></SheetClose>
                    </>
                  )}
                  <SheetClose asChild>
                    <button type="button" className="text-left text-lg" onClick={handleLogout}>Logout</button>
                  </SheetClose>
                </>
              ) : (
                <>
                  <SheetClose asChild>
                    <Link to="/host" className="flex items-center gap-3 text-lg">
                      <Home className="h-5 w-5" />
                      Become a Host
                    </Link>
                  </SheetClose>
                  <SheetClose asChild><Link to="/search" className="text-lg">Explore</Link></SheetClose>
                  <SheetClose asChild>
                    <button type="button" className="text-left text-lg" onClick={() => navigate('/login')}>Login</button>
                  </SheetClose>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
