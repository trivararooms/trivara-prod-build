import { Link, useNavigate } from 'react-router-dom';
import { Search, Menu, User, Home, X, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetClose } from '@/components/ui/sheet';
import { useAuth } from '@/hooks/useAuth';

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

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <header className={`sticky top-0 z-50 w-full ${variant === 'transparent' ? 'bg-transparent' : 'bg-surface-0'}`}>
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

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 rounded-full"
              >
                <Menu className="h-4 w-4" />
                <div className="h-8 w-8 rounded-full bg-surface-3 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-card border-border">
              {user ? (
                <>
                  <DropdownMenuItem onClick={() => navigate('/trips')}>
                    Your trips
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate('/saved')}>
                    Saved
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {isHost && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/host/dashboard')}>
                        Host dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/host/listings/new')}>
                        Create listing
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {isAdmin && (
                    <>
                      <DropdownMenuItem onClick={() => navigate('/admin/dashboard')}>
                        Admin dashboard
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate('/admin/dashboard/settings')}>
                        <ShieldCheck className="h-4 w-4 mr-2" />
                        Admin settings
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate('/account')}>
                    Account
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout}>
                    Log out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem onClick={() => navigate('/login')}>
                    Log in
                  </DropdownMenuItem>
                  {/* There's no separate signup flow - /login is Google OAuth for
                      both new and returning users, so a distinct "Sign up" entry
                      pointing at a non-existent /signup route has been removed. */}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate('/host')}>
                    Become a Host
                  </DropdownMenuItem>
                </>
              )}
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
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
