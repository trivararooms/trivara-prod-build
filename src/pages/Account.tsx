import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Calendar, 
  Home, 
  Plus, 
  User, 
  Settings, 
  CreditCard, 
  Bell,
  LogOut,
  ChevronRight,
  MapPin,
  Star,
  Users,
  Loader2
} from 'lucide-react';
import { listingService } from '@/services/listingService';
import { bookingService } from '@/services/bookingService';
import { earningsService } from '@/services/earningsService';
import { profileService, Profile } from '@/services/profileService';
import { formatINR } from '@/lib/utils';
import { Listing } from '@/types';

type DashboardStats = Awaited<ReturnType<typeof bookingService.getStats>>;
type EarningsStats = Awaited<ReturnType<typeof earningsService.getHostEarningsStats>>;

interface AccountData {
  profile: Profile | null;
  userListings: Listing[];
  dashboardStats: DashboardStats | null;
  earningsStats: EarningsStats | null;
}

async function fetchAccountData(user: NonNullable<ReturnType<typeof useAuth>['user']>): Promise<AccountData> {
  // Fetch user profile from profiles table
  let userProfile = await profileService.getByUserId(user.id);

  // If no profile exists, create one using auth data
  if (!userProfile) {
    const authUserData = {
      id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.first_name || user.user_metadata?.full_name?.split(' ')[0] || 'User',
      last_name: user.user_metadata?.last_name || user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
      avatar_url: user.user_metadata?.avatar_url || ''
    };
    userProfile = await profileService.createProfile(authUserData);
  }

  // Fetch user's listings
  const userListings = await listingService.getByHostId(user.id);

  // If user is a host, fetch host stats. Earnings come from earningsService
  // (real host_earnings rows, the 18%-platform-fee source of truth) rather
  // than bookingService.getStats(), which used to compute its own
  // (incorrect, 15%-fee) totalEarnings/pendingEarnings that disagreed with
  // what HostDashboard.tsx showed for the exact same host.
  const isHost = userListings.length > 0;
  const [dashboardStats, earningsStats] = await Promise.all([
    isHost ? bookingService.getStats(user.id) : Promise.resolve(null),
    isHost ? earningsService.getHostEarningsStats(user.id) : Promise.resolve(null),
  ]);

  return { profile: userProfile, userListings, dashboardStats, earningsStats };
}

const Account = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const accountQuery = useQuery({
    queryKey: ['account', user?.id],
    queryFn: () => fetchAccountData(user!),
    enabled: !!user?.id && !authLoading,
  });

  const profile = accountQuery.data?.profile ?? null;
  const dashboardStats = accountQuery.data?.dashboardStats ?? null;
  const earningsStats = accountQuery.data?.earningsStats ?? null;
  const userListings = accountQuery.data?.userListings ?? [];

  // Determine if user is host based on profile is_host flag (not listing count)
  const isHost = profile?.is_host || false;

  if (accountQuery.error) {
    console.error('Error fetching account data:', accountQuery.error);
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Auth is resolved and we have a user - the account query is enabled and
  // its own pending state (distinct from authLoading above) governs the
  // spinner from here on.
  if (accountQuery.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  // Get user display name and avatar from profile
  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : 'User';
  const userEmail = profile?.email || user.email || '';
  const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || '';

  // Generate initials for fallback avatar
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Page Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-display font-medium text-foreground mb-2">
            Account
          </h1>
          <p className="text-lg text-text-secondary">
            Manage your trips, listings, and account preferences
          </p>
        </div>

        {/* User Info Card */}
        <Card className="mb-12 bg-card border-border">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <Avatar className="h-20 w-20">
                <AvatarImage src={avatarUrl} alt={displayName} />
                <AvatarFallback className="bg-accent text-accent-foreground text-xl font-medium">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h2 className="text-2xl font-medium text-foreground mb-1">
                  {displayName}
                </h2>
                <p className="text-text-secondary mb-3">
                  {userEmail}
                </p>
                <Badge
                  variant={isHost ? "default" : "secondary"}
                  className={`font-morderline text-[10px] tracking-wide ${isHost ? "bg-accent" : "bg-surface-3"}`}
                >
                  {isHost ? 'Host' : 'Guest'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Primary Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {/* My Trips */}
          <Card className="bg-card border-border hover:bg-surface-3 transition-colors cursor-pointer group">
            <CardContent 
              className="p-6 flex flex-col items-center text-center"
              onClick={() => navigate('/trips')}
            >
              <Calendar className="h-10 w-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-medium text-foreground mb-2">My Trips</h3>
              <p className="text-text-secondary">View upcoming & past stays</p>
            </CardContent>
          </Card>

          {/* Host Dashboard (Host only) */}
          {isHost && (
            <Card className="bg-card border-border hover:bg-surface-3 transition-colors cursor-pointer group">
              <CardContent 
                className="p-6 flex flex-col items-center text-center"
                onClick={() => navigate('/host/dashboard')}
              >
                <Home className="h-10 w-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-medium text-foreground mb-2">Host Dashboard</h3>
                <p className="text-text-secondary">Manage your listings & bookings</p>
              </CardContent>
            </Card>
          )}

          {/* Create Listing (Host) or Become Host (Guest) */}
          <Card className="bg-accent border-accent hover:bg-accent-hover transition-colors cursor-pointer group">
            <CardContent 
              className="p-6 flex flex-col items-center text-center"
              onClick={() => isHost ? navigate('/host/listings/new') : navigate('/host')}
            >
              <Plus className="h-10 w-10 text-accent-foreground mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-xl font-medium text-accent-foreground mb-2">
                {isHost ? 'Create a new listing' : 'Become a Host'}
              </h3>
              <p className="text-accent-foreground/80">
                {isHost ? 'List your place on Trivara' : 'List your place on Trivara'}
              </p>
            </CardContent>
          </Card>

          {/* Additional Host Card - Only show if user is host and we need 3 cards for grid */}
          {isHost && (
            <Card className="bg-card border-border hover:bg-surface-3 transition-colors cursor-pointer group">
              <CardContent 
                className="p-6 flex flex-col items-center text-center"
                onClick={() => navigate('/host/dashboard')}
              >
                <Calendar className="h-10 w-10 text-accent mb-4 group-hover:scale-110 transition-transform" />
                <h3 className="text-xl font-medium text-foreground mb-2">Manage Bookings</h3>
                <p className="text-text-secondary">Handle reservations & guest communication</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Quick Stats Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-medium text-foreground mb-6">Quick Stats</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Guest Stats */}
            {!isHost && (
              <>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {dashboardStats?.confirmedBookings || 0}
                        </p>
                        <p className="text-sm text-text-secondary">Trips booked</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {dashboardStats?.confirmedBookings || 0}
                        </p>
                        <p className="text-sm text-text-secondary">Upcoming stays</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {dashboardStats?.completedBookings || 0}
                        </p>
                        <p className="text-sm text-text-secondary">Reviews written</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">0</p>
                        <p className="text-sm text-text-secondary">Hosting months</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
            
            {/* Host Stats */}
            {isHost && (
              <>
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Home className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">{userListings.length}</p>
                        <p className="text-sm text-text-secondary">Listings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {dashboardStats?.confirmedBookings || 0}
                        </p>
                        <p className="text-sm text-text-secondary">Active bookings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Star className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {dashboardStats?.completedBookings || 0}
                        </p>
                        <p className="text-sm text-text-secondary">Completed stays</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card className="bg-card border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <Users className="h-5 w-5 text-accent" />
                      <div>
                        <p className="text-2xl font-medium text-foreground">
                          {formatINR(earningsStats?.totalEarnings || 0)}
                        </p>
                        <p className="text-sm text-text-secondary">Total earnings</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        {/* Account Options */}
        <div className="mb-12">
          <h2 className="text-2xl font-medium text-foreground mb-6">Account Options</h2>
          
          <Card className="bg-card border-border">
            <CardContent className="p-0">
              {/* Account Settings */}
              <div
                className="flex items-center justify-between p-4 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => navigate('/account/settings')}
              >
                <div className="flex items-center gap-4">
                  <Settings className="h-5 w-5 text-text-secondary" />
                  <span className="text-foreground">Account settings</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </div>
              </div>
              
              {/* Payment Methods */}
              <div 
                className="flex items-center justify-between p-4 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => navigate('/account/payment-methods')}
              >
                <div className="flex items-center gap-4">
                  <CreditCard className="h-5 w-5 text-text-secondary" />
                  <span className="text-foreground">Payout account</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </div>
              </div>
              
              {/* Notifications */}
              <div
                className="flex items-center justify-between p-4 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => navigate('/account/notifications')}
              >
                <div className="flex items-center gap-4">
                  <Bell className="h-5 w-5 text-text-secondary" />
                  <span className="text-foreground">Notifications</span>
                </div>
                <div className="flex items-center gap-2">
                  <ChevronRight className="h-4 w-4 text-text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logout Section */}
        <div className="flex flex-col items-center gap-4 pt-8 border-t border-border">
          <Button 
            variant="outline" 
            className="bg-transparent border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Log out
          </Button>
          <p className="text-sm text-text-secondary">
            Logged in via Google
          </p>
        </div>
      </div>
    </div>
  );
};

export default Account;