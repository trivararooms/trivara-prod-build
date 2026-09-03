import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, User, Home, X, ShieldCheck, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';
import { messageService } from '@/services/messageService';

interface HeaderProps {
  variant?: 'default' | 'transparent';
}

export function Header({ variant = 'default' }: HeaderProps) {
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

  return (
    <header className={`sticky top-0 z-50 w-full ${variant === 'transparent' ? 'bg-transparent' : 'bg-surface-0 border-b border-border'}`}>
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Trivara
          </span>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          <Link to="/search" className="text-sm text-text-secondary hover:text-foreground trivara-transition">
            Explore
          </Link>
          <Link to="/host" className="text-sm text-text-secondary hover:text-foreground trivara-transition">
            Host
          </Link>
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          {/* Desktop Search */}
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:flex hover:bg-surface-2"
            onClick={() => navigate('/search')}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Desktop Messages */}
          {user && (
            <Button
              variant="ghost"
              size="icon"
              className="relative hidden md:flex hover:bg-surface-2"
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

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 rounded-full"
              >
                <Menu className="h-4 w-4" />
                <div className="h-8 w-8 rounded-full bg-surface-3 border border-border flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 bg-card border-border p-3">
              <div className="grid grid-cols-2 gap-2">
                {user ? (
                  <>
                    <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/trips')}>
                      Your trips
                    </DropdownMenuItem>
                    <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/saved')}>
                      Saved
                    </DropdownMenuItem>
                    <DropdownMenuItem className="relative border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/messages')}>
                      Messages
                      {unreadMessages > 0 && (
                        <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-morderline flex items-center justify-center">
                          {unreadMessages}
                        </span>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/account')}>
                      Account
                    </DropdownMenuItem>
                    {isHost && (
                      <>
                        <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3 bg-accent/10" onClick={() => navigate('/host/dashboard')}>
                          Host dashboard
                        </DropdownMenuItem>
                        <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3 bg-accent/10" onClick={() => navigate('/host/listings/new')}>
                          Create listing
                        </DropdownMenuItem>
                      </>
                    )}
                    {isAdmin && (
                      <>
                        <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3 bg-primary/10" onClick={() => navigate('/admin/dashboard')}>
                          Admin dashboard
                        </DropdownMenuItem>
                        <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3 bg-primary/10" onClick={() => navigate('/admin/dashboard/settings')}>
                          <ShieldCheck className="h-4 w-4 mr-1" />
                          Admin settings
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuItem className="col-span-2 border border-border rounded-lg justify-center text-center py-3" onClick={handleLogout}>
                      Log out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    {/* There's no separate signup flow - /login is Google OAuth for
                        both new and returning users, so a distinct "Sign up" entry
                        pointing at a non-existent /signup route has been removed. */}
                    <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/login')}>
                      Log in
                    </DropdownMenuItem>
                    <DropdownMenuItem className="border border-border rounded-lg justify-center text-center py-3" onClick={() => navigate('/host')}>
                      Become a Host
                    </DropdownMenuItem>
                  </>
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Mobile Menu */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover:bg-surface-2">
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
                <SheetClose asChild>
                  <Link to="/host" className="flex items-center gap-3 text-lg">
                    <Home className="h-5 w-5" />
                    Become a Host
                  </Link>
                </SheetClose>
                {user && (
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
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
