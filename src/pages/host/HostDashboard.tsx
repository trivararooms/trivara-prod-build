import { Navigate, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  DollarSign,
  Users,
  Plus,
  Eye,
  Edit,
  MapPin,
  Loader2,
  MessageCircle
} from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { listingService } from '@/services/listingService';
import { bookingService } from '@/services/bookingService';
import { earningsService } from '@/services/earningsService';
import { profileService } from '@/services/profileService';
import { messageService } from '@/services/messageService';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { Listing, Booking } from '@/types';

type EnrichedBooking = Booking & { guestName: string; property: string; dates: string };

interface HostDashboardStats {
  totalBookings: number;
  confirmedBookings: number;
  completedBookings: number;
  totalEarnings: number;
  pendingEarnings: number;
}

interface HostDashboardData {
  listings: Listing[];
  stats: HostDashboardStats;
  bookings: EnrichedBooking[];
}

async function fetchHostDashboardData(hostId: string): Promise<HostDashboardData> {
  // Past bookings are now flipped to 'completed' by a server-side
  // scheduled job (see supabase/migrations) rather than client-triggered
  // here on every page load.

  // Fetch host listings
  const listings = await listingService.getByHostId(hostId);

  // Fetch booking stats
  const bookingStats = await bookingService.getStats(hostId);

  // Fetch earnings stats directly from host_earnings table
  const earningsStats = await earningsService.getHostEarningsStats(hostId);

  console.log('Dashboard earnings stats:', earningsStats); // Debug log

  const stats: HostDashboardStats = {
    ...bookingStats,
    totalEarnings: earningsStats.totalEarnings,
    pendingEarnings: earningsStats.pendingEarnings,
  };

  // Fetch all host bookings
  const allBookings = await bookingService.getByHostId(hostId);

  // Enrich bookings with listing info and the guest's real name (hosts used
  // to see the literal word "Guest" for every booking here - the guest's
  // profile is visible to the host once a booking exists, same as the
  // listing/host info a guest sees on the listing page).
  const bookings = await Promise.all(
    allBookings.map(async (booking) => {
      try {
        const [listing, guestProfile] = await Promise.all([
          listingService.getById(booking.listingId),
          profileService.getByUserId(booking.guestId),
        ]);
        const guestName = guestProfile
          ? `${guestProfile.first_name} ${guestProfile.last_name}`.trim() || 'Guest'
          : 'Guest';
        return {
          ...booking,
          guestName,
          property: listing?.title || 'Unknown Property',
          dates: `${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}`,
        };
      } catch (error) {
        console.error('Error enriching booking:', error);
        return {
          ...booking,
          guestName: 'Guest',
          property: 'Unknown Property',
          dates: `${new Date(booking.checkIn).toLocaleDateString()} - ${new Date(booking.checkOut).toLocaleDateString()}`,
        };
      }
    })
  );

  return { listings, stats, bookings };
}

export default function HostDashboard() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [messagingBookingId, setMessagingBookingId] = useState<string | null>(null);

  const dashboardQuery = useQuery({
    queryKey: ['host-dashboard', user?.id],
    queryFn: () => fetchHostDashboardData(user!.id),
    enabled: !!user?.id,
  });

  const listings = dashboardQuery.data?.listings ?? [];
  const stats = dashboardQuery.data?.stats ?? null;
  const bookings = dashboardQuery.data?.bookings ?? [];

  useEffect(() => {
    if (dashboardQuery.error) {
      console.error('Error fetching dashboard data:', dashboardQuery.error);
    }
  }, [dashboardQuery.error]);

  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => bookingService.cancelBooking(bookingId),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Booking cancelled',
          description: result.refunded
            ? 'The booking has been cancelled, the guest was refunded, and the dates are now available.'
            : 'The booking has been cancelled and the dates are now available.',
        });
        queryClient.invalidateQueries({ queryKey: ['host-dashboard', user?.id] });
      } else {
        toast({
          title: 'Cancellation failed',
          description: result.error || 'Could not cancel the booking. Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: unknown) => {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'An error occurred while cancelling the booking.'),
        variant: 'destructive',
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (bookingId: string) => bookingService.approveBookingRequest(bookingId),
    onSuccess: (result) => {
      if (result.success) {
        toast({
          title: 'Request approved',
          description: 'The guest can now complete payment from their trips page.',
        });
        queryClient.invalidateQueries({ queryKey: ['host-dashboard', user?.id] });
      } else {
        toast({
          title: 'Could not approve request',
          description: result.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: unknown) => {
      console.error('Error approving booking request:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'An error occurred while approving the request.'),
        variant: 'destructive',
      });
    },
  });

  const handleApproveRequest = (bookingId: string) => {
    approveMutation.mutate(bookingId);
  };

  const handleMessageGuest = async (booking: EnrichedBooking) => {
    if (!user?.id) return;
    setMessagingBookingId(booking.id);
    try {
      const conversation = await messageService.findOrCreateConversation(
        booking.listingId,
        booking.guestId,
        user.id
      );
      navigate(`/messages?c=${conversation.id}`);
    } catch (error: unknown) {
      console.error('Error opening conversation with guest:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Could not open a conversation with this guest.'),
        variant: 'destructive',
      });
    } finally {
      setMessagingBookingId(null);
    }
  };

  const publishMutation = useMutation({
    mutationFn: (listingId: string) => listingService.publishListing(listingId),
    onSuccess: (result) => {
      if (result) {
        toast({
          title: 'Listing published!',
          description: 'Your listing is now live and visible to guests.',
        });
        queryClient.invalidateQueries({ queryKey: ['host-dashboard', user?.id] });
      } else {
        toast({
          title: 'Publish failed',
          description: 'Could not publish the listing. Please try again.',
          variant: 'destructive',
        });
      }
    },
    onError: (error: unknown) => {
      console.error('Error publishing listing:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'An error occurred while publishing the listing.'),
        variant: 'destructive',
      });
    },
  });

  const handleCancelBooking = (bookingId: string) => {
    cancelMutation.mutate(bookingId);
  };

  const handlePublishListing = (listingId: string) => {
    publishMutation.mutate(listingId);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'published':
        return 'default';
      case 'draft':
        return 'secondary';
      case 'confirmed':
        return 'default';
      case 'completed':
        return 'secondary';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
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

  // This page is already wrapped in <ProtectedRoute>, so `user` should always
  // be set by the time we get here - but gating on authLoading/!user first
  // (rather than trusting the query alone) matters because react-query's
  // `isPending` stays true forever for a *disabled* query (enabled:
  // !!user?.id false), so without this a missing user would show this
  // spinner forever instead of ever resolving.
  if (dashboardQuery.isPending) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-accent" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide text-foreground mb-2">
              Host Dashboard
            </h1>
            <p className="text-lg text-text-secondary">
              Manage your listings, bookings, and earnings
            </p>
          </div>
          <Button
            className="bg-accent text-accent-foreground hover:bg-accent-hover gap-2 h-11"
            onClick={() => navigate('/host/listings/new')}
          >
            <Plus className="h-4 w-4" />
            Create new listing
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Home className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">{listings.length}</p>
                  <p className="text-sm text-text-secondary">Total Listings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">
                    {stats?.confirmedBookings || 0}
                  </p>
                  <p className="text-sm text-text-secondary">Active Bookings</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Users className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-semibold text-foreground">
                    {stats?.confirmedBookings || 0}
                  </p>
                  <p className="text-sm text-text-secondary">Upcoming Check-ins</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card
            className="bg-card border-border cursor-pointer transition-all duration-200 hover:bg-card/80 hover:border-accent/30"
            onClick={() => navigate('/host/earnings')}
          >
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <DollarSign className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-3xl font-pillar font-bold text-accent">
                    {formatINR(stats?.totalEarnings || 0)}
                  </p>
                  <p className="text-sm text-text-secondary">Total Earnings</p>
                  <p className="text-xs text-text-meta mt-1">
                    Pending: {formatINR(stats?.pendingEarnings || 0)}
                  </p>
                  <p className="text-xs text-accent mt-1 flex items-center gap-1">
                    View earnings breakdown →
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Listings Table */}
          <div className="lg:col-span-2">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl font-medium text-foreground">Your Listings</CardTitle>
              </CardHeader>
              <CardContent>
                {listings.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Price / night</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listings.map((listing) => (
                        <TableRow key={listing.id} className="hover:bg-surface-2">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-lg overflow-hidden bg-surface-0">
                                {listing.photos && listing.photos[0] ? (
                                  <img
                                    src={listing.photos[0]}
                                    alt={listing.title}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                                    <Home className="h-5 w-5 text-text-secondary" />
                                  </div>
                                )}
                              </div>
                              <span className="font-medium text-foreground">{listing.title}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-text-secondary">
                              <MapPin className="h-4 w-4" />
                              {listing.location?.city}, {listing.location?.state}
                            </div>
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {formatINR(listing.pricePerNight)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getStatusBadgeVariant(listing.status)}>
                              {listing.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {listing.status === 'draft' && (
                                <Button
                                  variant="default"
                                  size="sm"
                                  className="h-8 bg-accent text-accent-foreground hover:bg-accent-hover"
                                  onClick={() => handlePublishListing(listing.id)}
                                  disabled={publishMutation.isPending && publishMutation.variables === listing.id}
                                >
                                  {publishMutation.isPending && publishMutation.variables === listing.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Publish'
                                  )}
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-surface-3"
                                onClick={() => navigate(`/listing/${listing.id}`)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-surface-3"
                                onClick={() => navigate(`/host/listings/${listing.id}/edit`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 hover:bg-surface-3"
                                onClick={() => navigate(`/host/listings/${listing.id}/calendar`)}
                                title="Manage calendar"
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-12 text-center">
                    <Home className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-foreground mb-2">No listings yet</h3>
                    <p className="text-text-secondary mb-6">Create your first listing draft to get started</p>
                    <Button
                      className="bg-accent text-accent-foreground hover:bg-accent-hover"
                      onClick={() => navigate('/host/listings/new')}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create your first listing draft
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bookings Section */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-xl font-medium text-foreground">Bookings</CardTitle>
              </CardHeader>
              <CardContent>
                {bookings.length > 0 ? (
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {bookings.map((booking) => (
                      <div key={booking.id} className="flex items-start gap-3 pb-4 border-b border-border last:border-b-0 last:pb-0">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{booking.guestName}</p>
                          <p className="text-sm text-text-secondary truncate">{booking.property}</p>
                          <p className="text-xs text-text-meta mt-1">{booking.dates}</p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <Badge variant={getStatusBadgeVariant(booking.status)}>
                            {booking.status}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs gap-1"
                            disabled={messagingBookingId === booking.id}
                            onClick={() => handleMessageGuest(booking)}
                          >
                            {messagingBookingId === booking.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <MessageCircle className="h-3 w-3" />
                                Message
                              </>
                            )}
                          </Button>
                          {booking.status === 'pending' && (
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                className="h-6 text-xs bg-accent text-accent-foreground hover:bg-accent-hover"
                                disabled={
                                  (approveMutation.isPending && approveMutation.variables === booking.id)
                                  || (cancelMutation.isPending && cancelMutation.variables === booking.id)
                                }
                                onClick={() => handleApproveRequest(booking.id)}
                              >
                                {approveMutation.isPending && approveMutation.variables === booking.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Approve'
                                )}
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                    disabled={
                                      (cancelMutation.isPending && cancelMutation.variables === booking.id)
                                      || (approveMutation.isPending && approveMutation.variables === booking.id)
                                    }
                                  >
                                    {cancelMutation.isPending && cancelMutation.variables === booking.id ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      'Decline'
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Decline this request?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      The guest will be notified that their request for {booking.property} wasn't approved.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Keep pending</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleCancelBooking(booking.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Yes, decline
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                          {booking.status === 'confirmed' && new Date() < new Date(booking.checkIn) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                                  disabled={cancelMutation.isPending && cancelMutation.variables === booking.id}
                                >
                                  {cancelMutation.isPending && cancelMutation.variables === booking.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    'Cancel'
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel this booking for {booking.property}?
                                    The dates will be released and the guest will be notified.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep booking</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleCancelBooking(booking.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Yes, cancel
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <Calendar className="h-10 w-10 text-text-secondary mx-auto mb-3" />
                    <p className="text-text-secondary text-sm">No bookings yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-8 border-t border-border text-center">
          <p className="text-sm text-text-secondary">
            Publish your drafts to make them visible to guests.
          </p>
        </div>
      </div>
    </div>
  );
}
