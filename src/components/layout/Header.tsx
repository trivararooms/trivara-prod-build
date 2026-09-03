import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, Home, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { messageService } from '@/services/messageService';
import { Logo } from '@/components/layout/Logo';

// The one common navbar for every page - there is no longer a separate
// "default" sticky-bar-with-avatar-dropdown design. It started as the
// homepage hero's overlay treatment (see git history / PR history for
// "hero-nav-centering") and was promoted sitewide: sticky + transparent, so
// whatever page background sits behind it (now the same site-wide gradient
// everywhere, see App.tsx's SiteBackground) shows through consistently.
export function Header() {
  const navigate = useNavigate();
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

  const navLinkClass = 'text-[11px] font-bold uppercase tracking-wide text-[#0a0806] hover:text-foreground trivara-transition';
  const iconButtonClass = 'hidden md:flex text-[#0a0806] hover:text-foreground hover:bg-transparent';

  // Mirrors the mock's own locked page margin (--page-margin: clamp(20px,
  // 4vw, 48px)) instead of Tailwind's default .container gutter - kept as
  // its own literal here (rather than importing tailwind.config's now-equal
  // .container padding) so the header's spacing doesn't silently drift if
  // one or the other changes later.
  const sidePad = 'px-[clamp(20px,4vw,48px)]';

  return (
    // sticky, not fixed: fixed would contribute zero height to the page's
    // own flow, which sounds convenient but actually means the header's own
    // box (transparent or not) sits on top of - and intercepts clicks on -
    // whatever each page renders in that first ~80px, on every single page
    // that doesn't already reserve space for it. sticky instead occupies
    // real flow height like a normal element while still pinning to the top
    // on scroll, so nothing underneath it is ever covered or unclickable;
    // the only cost is a min-h-screen section running ~80px past one
    // viewport, which is cosmetic, not functional.
    <header className="sticky top-0 z-20 w-full bg-transparent">
      <div className={`w-full ${sidePad} grid grid-cols-[1fr_auto_1fr] h-20 items-center`}>
        {/* Logo - flush against the same side padding the footer's logo
            uses, so the two sit parallel to each other. */}
        <Link to="/" className="flex items-center gap-2 justify-self-start">
          <Logo markClassName="h-11 w-11" nameClassName="text-2xl" />
        </Link>

        {/* Desktop Navigation - centered in its own grid column; search and
            messages icons sit in this same group rather than off to the
            side. Logout is leftmost when signed in. */}
        <nav className="hidden md:flex items-center gap-8 justify-self-center">
          {user && (
            <button type="button" className={navLinkClass} onClick={handleLogout}>
              Logout
            </button>
          )}
          <Link to="/search" className={navLinkClass}>
            Explore
          </Link>
          {user ? (
            <>
              <Link to="/trips" className={navLinkClass}>Your Trips</Link>
              <Link to="/saved" className={navLinkClass}>Saved</Link>
              <Link to="/account" className={navLinkClass}>Account Settings</Link>
              {/* Admin tools go rightmost, after the account shortcuts. */}
              {isAdmin && (
                <>
                  <Link to="/admin/dashboard" className={navLinkClass}>Admin Dashboard</Link>
                  <Link to="/admin/dashboard/settings" className={navLinkClass}>Admin Settings</Link>
                </>
              )}
            </>
          ) : (
            <button type="button" className={navLinkClass} onClick={() => navigate('/login')}>
              Login
            </button>
          )}

          <Button variant="ghost" size="icon" className={iconButtonClass} onClick={() => navigate('/search')}>
            <Search className="h-5 w-5" />
          </Button>
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className={`relative ${iconButtonClass}`}
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="h-5 w-5" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-morderline flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </Button>
          )}
        </nav>

        {/* Right Side - Become a Host is a standing CTA, logo-sized, right-
            aligned the same way the footer's copyright is, shown regardless
            of signed-in state (unlike the rest of the nav) since it's not
            an account shortcut. Hidden once someone already is a host. */}
        <div className="flex items-center gap-4 justify-self-end">
          {!isHost && (
            <Link to="/host" className={`${navLinkClass} !text-2xl !normal-case !tracking-normal font-bold`}>
              Become a Host
            </Link>
          )}

          {/* Mobile Menu - the only menu on the page now; there is no
              separate avatar/dropdown menu at any breakpoint. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden text-[#0a0806] hover:text-foreground hover:bg-transparent">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-surface-0 border-border">
              <div className="flex flex-col gap-6 mt-8">
                <SheetClose asChild>
                  <Link to="/search" className="flex items-center gap-3 text-lg">
                    <Search className="h-5 w-5" />
                    Explore
                  </Link>
                </SheetClose>
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
                    <SheetClose asChild>
                      <Link to="/trips" className="text-lg">Your Trips</Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/saved" className="text-lg">Saved</Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/account" className="text-lg">Account Settings</Link>
                    </SheetClose>
                    <SheetClose asChild>
                      <Link to="/messages" className="flex items-center gap-3 text-lg">
                        <MessageCircle className="h-5 w-5" />
                        Messages
                        {unreadMessages > 0 && (
                          <span className="h-5 min-w-5 px-1 rounded-full bg-accent text-accent-foreground text-xs flex items-center justify-center font-medium">
                            {unreadMessages}
                          </span>
                        )}
                      </Link>
                    </SheetClose>
                    {isAdmin && (
                      <>
                        <SheetClose asChild>
                          <Link to="/admin/dashboard" className="text-lg">Admin Dashboard</Link>
                        </SheetClose>
                        <SheetClose asChild>
                          <Link to="/admin/dashboard/settings" className="text-lg">Admin Settings</Link>
                        </SheetClose>
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
                    <SheetClose asChild>
                      <button type="button" className="text-left text-lg" onClick={() => navigate('/login')}>Login</button>
                    </SheetClose>
                  </>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
