import { useEffect, useState, useRef, useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { formatINR } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { getErrorMessage } from '@/lib/errors';
import { Loader2, RefreshCw, Settings } from 'lucide-react';

type DashboardStats = {
  total_listings: number;
  total_bookings: number;
  active_bookings: number;
  completed_bookings: number;
  platform_revenue: number;
  pending_payouts: number;
};

type PayoutRequest = {
  id: string;
  host_id: string;
  booking_id: string | null;
  amount: number;
  currency: string;
  status: string;
  requested_at: string;
  paid_at: string | null;
  notes: string | null;
  bookings?: {
    id: string;
    listings?: { title: string } | null;
  } | null;
  host?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  host_bank_account?: {
    account_holder_name: string;
    bank_name: string;
    account_last_four: string;
    ifsc_code: string;
  } | null;
};

// Admins only ever see a masked account number - get_bank_details_for_payout()
// is admin-only (checked inside the function) and returns just the last 4
// digits, never the full account_number column.
async function fetchMaskedBankDetails(hostIds: string[]) {
  const results = await Promise.all(
    hostIds.map(async (hostId) => {
      const { data, error } = await supabase.rpc('get_bank_details_for_payout', {
        p_host_id: hostId,
      });
      if (error || !data?.[0]) return null;
      return { host_id: hostId, ...data[0] };
    })
  );
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

export default function AdminDashboard() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Refs for cleanup
  const statsSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const payoutsSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const listingsSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const bookingsSubscriptionRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refreshStats = useCallback(async () => {
    try {
      const { data: statsData, error: statsError } = await supabase.rpc('admin_dashboard_stats');
      if (!statsError && statsData) {
        // RPC returns an array with a single object
        setStats(statsData?.[0] as DashboardStats);
        setLastUpdated(new Date());
        console.log('Stats refreshed in real-time');
      }
    } catch (error) {
      console.error('Error refreshing stats:', error);
    }
  }, []);

  const refreshPayoutRequests = useCallback(async () => {
    try {
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payout_requests')
        .select(`
          *,
          bookings (
            id,
            listings (
              title
            )
          )
        `)
        .order('requested_at', { ascending: false });

      if (!payoutsError && payoutsData) {
        if (payoutsData && payoutsData.length > 0) {
          // Fetch host details for each payout request
          const hostIds = [...new Set(payoutsData.map(p => p.host_id))];

          const { data: profilesData, error: profilesError } = await supabase
            .from('profiles')
            .select('id, full_name, role')
            .in('id', hostIds);

          // Fetch masked bank account details for each payout request
          const bankAccountsData = await fetchMaskedBankDetails(hostIds);

          // Combine the data manually
          const enrichedPayoutsData = payoutsData.map(payout => {
            const profile = profilesData?.find(p => p.id === payout.host_id);
            const bankAccount = bankAccountsData.find(b => b.host_id === payout.host_id);

            return {
              ...payout,
              host: profile || null,
              host_bank_account: bankAccount || null
            };
          });

          setPayoutRequests(enrichedPayoutsData);
        } else {
          setPayoutRequests([]);
        }

        setLastUpdated(new Date());
        console.log('Payout requests refreshed in real-time');
      }
    } catch (error) {
      console.error('Error refreshing payout requests:', error);
    }
  }, []);

  const cleanupSubscriptions = useCallback(() => {
    if (listingsSubscriptionRef.current) {
      listingsSubscriptionRef.current.unsubscribe();
    }
    if (bookingsSubscriptionRef.current) {
      bookingsSubscriptionRef.current.unsubscribe();
    }
    if (payoutsSubscriptionRef.current) {
      payoutsSubscriptionRef.current.unsubscribe();
    }
    if (statsSubscriptionRef.current) {
      statsSubscriptionRef.current.unsubscribe();
    }
    console.log('Real-time subscriptions cleaned up');
  }, []);

  const setupRealtimeSubscriptions = useCallback(() => {
    // Subscribe to listings changes
    listingsSubscriptionRef.current = supabase
      .channel('admin:listings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listings'
        },
        (payload) => {
          console.log('Listings change detected:', payload);
          // Refresh stats when listings change
          refreshStats();
        }
      )
      .subscribe();

    // Subscribe to bookings changes
    bookingsSubscriptionRef.current = supabase
      .channel('admin:bookings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        (payload) => {
          console.log('Bookings change detected:', payload);
          // Refresh stats when bookings change
          refreshStats();
        }
      )
      .subscribe();

    // Subscribe to payout requests changes
    payoutsSubscriptionRef.current = supabase
      .channel('admin:payout_requests')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payout_requests'
        },
        (payload) => {
          console.log('Payout request change detected:', payload);
          // Refresh payout requests when they change
          refreshPayoutRequests();
        }
      )
      .subscribe();

    // Subscribe to host earnings changes (affects platform revenue)
    statsSubscriptionRef.current = supabase
      .channel('admin:host_earnings')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'host_earnings'
        },
        (payload) => {
          console.log('Host earnings change detected:', payload);
          // Refresh stats when earnings change
          refreshStats();
        }
      )
      .subscribe();

    console.log('Real-time subscriptions established');
  }, [refreshStats, refreshPayoutRequests]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch dashboard stats
      const { data: statsData, error: statsError } = await supabase.rpc('admin_dashboard_stats');
      if (statsError) throw statsError;
      // RPC returns an array with a single object, so we need to access the first element
      setStats(statsData?.[0] as DashboardStats);

      // Fetch payout requests with separate queries for host and bank details
      // Now including booking details as well
      const { data: payoutsData, error: payoutsError } = await supabase
        .from('payout_requests')
        .select(`
          *,
          bookings (
            id,
            listings (
              title
            )
          )
        `)
        .order('requested_at', { ascending: false });

      if (payoutsData && payoutsData.length > 0) {
        // Fetch host details for each payout request
        const hostIds = [...new Set(payoutsData.map(p => p.host_id))];

        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .in('id', hostIds);

        // Fetch masked bank account details for each payout request
        const bankAccountsData = await fetchMaskedBankDetails(hostIds);

        // Combine the data manually
        const enrichedPayoutsData = payoutsData.map(payout => {
          const profile = profilesData?.find(p => p.id === payout.host_id);
          const bankAccount = bankAccountsData.find(b => b.host_id === payout.host_id);

          return {
            ...payout,
            host: profile || null,
            host_bank_account: bankAccount || null
          };
        });

        setPayoutRequests(enrichedPayoutsData);
      } else {
        setPayoutRequests([]);
      }

      if (payoutsError) {
        console.warn('Payout fetch warning:', payoutsError);
      }

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Admin access is already enforced by <ProtectedRoute requiredRole="admin">
    // (backed by AuthContext's profile.role + Postgres RLS/is_admin()), so this
    // effect just needs to wait for auth to resolve, then load data.
    //
    // This used to ALSO re-check a hardcoded isAdminEmail(user.email) and
    // re-fetch profiles.role by email as "defense in depth". Duplicating the
    // check was the bug: if either of those two checks ever disagreed with
    // ProtectedRoute's own DB-backed check (different email casing, a second
    // admin account, a transient query error), this effect called navigate('/')
    // without ever calling fetchData() - and since `loading` only gets set to
    // false inside fetchData()'s finally block, the page was left stuck on its
    // loading spinner forever instead of actually redirecting.
    if (authLoading || !user) return;

    fetchData();
    setupRealtimeSubscriptions();

    // Cleanup subscriptions on unmount
    return () => {
      cleanupSubscriptions();
    };
  }, [user, authLoading, fetchData, setupRealtimeSubscriptions, cleanupSubscriptions]);

  const handleManualRefresh = async () => {
    setLoading(true);
    try {
      await fetchData();
      toast({
        title: 'Success',
        description: 'Dashboard data refreshed',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to refresh dashboard data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApprovePayout = async (payoutId: string) => {
    setApprovingId(payoutId);
    try {
      console.log('Calling approve_payout_request RPC for:', payoutId);
      const { data, error } = await supabase.rpc('approve_payout_request', {
        p_payout_id: payoutId,
      });

      if (error) {
        console.error('RPC Error:', error);
        throw error;
      }

      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to approve payout');
      }

      toast({
        title: 'Success',
        description: data?.message || 'Payout approved successfully',
      });

      // Refresh data after approval
      await Promise.all([refreshStats(), refreshPayoutRequests()]);
    } catch (error: unknown) {
      console.error('Error approving payout:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to approve payout. Check if you have admin permissions.'),
        variant: 'destructive',
      });
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectPayout = async (payoutId: string) => {
    setRejectingId(payoutId);
    try {
      const { data, error } = await supabase.rpc('reject_payout_request', {
        p_payout_id: payoutId,
        p_reason: rejectReasons[payoutId] || null,
      });

      if (error) throw error;

      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to reject payout');
      }

      toast({
        title: 'Payout rejected',
        description: data?.message || 'The payout request has been rejected.',
      });

      setRejectReasons(prev => {
        const next = { ...prev };
        delete next[payoutId];
        return next;
      });

      await Promise.all([refreshStats(), refreshPayoutRequests()]);
    } catch (error: unknown) {
      console.error('Error rejecting payout:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to reject payout. Check if you have admin permissions.'),
        variant: 'destructive',
      });
    } finally {
      setRejectingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide">
            Admin Dashboard
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-text-secondary flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Live updates enabled
              <span className="text-xs">• Last updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/dashboard/settings')}
            >
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualRefresh}
              disabled={loading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Total Listings</p>
              <p className="text-3xl font-semibold">{stats?.total_listings || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Total Bookings</p>
              <p className="text-3xl font-semibold">{stats?.total_bookings || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Active Bookings</p>
              <p className="text-3xl font-semibold">{stats?.active_bookings || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Completed Bookings</p>
              <p className="text-3xl font-semibold">{stats?.completed_bookings || 0}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Platform Revenue</p>
              <p className="text-3xl font-semibold">{formatINR(stats?.platform_revenue || 0)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Pending Host Payouts</p>
              <p className="text-3xl font-semibold">{formatINR(stats?.pending_payouts || 0)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payout Requests Section */}
        <Card>
          <CardHeader>
            <CardTitle>Payout Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {(payoutRequests ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">No payout requests found.</p>
            ) : (
              <div className="space-y-4">
                {payoutRequests.map(request => (
                  <Card key={request.id} className="border p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        {/* Booking Context */}
                        <div className="mb-4 p-3 bg-muted/50 rounded-md">
                          <h4 className="font-medium text-sm mb-1">Booking Context</h4>
                          {request.bookings ? (
                            <>
                              <p className="text-sm"><span className="font-medium">Property:</span> {request.bookings.listings?.title || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">Booking ID: {request.booking_id}</p>
                            </>
                          ) : (
                            <p className="text-sm text-muted-foreground">General Payout Request (No Booking ID)</p>
                          )}
                        </div>

                        <h4 className="font-medium mb-2">Host Information</h4>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Email:</span> N/A
                        </p>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Name:</span> {request.host?.full_name || 'N/A'}
                        </p>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Host ID:</span> {request.host_id}
                        </p>
                        <p className="text-sm mb-4">
                          <span className="font-medium">Amount:</span> {formatINR(request.amount)} ({request.currency})
                        </p>
                      </div>
                      <div>
                        <h4 className="font-medium mb-2">Bank Details</h4>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Account Holder:</span> {request.host_bank_account?.account_holder_name || 'N/A'}
                        </p>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Bank Name:</span> {request.host_bank_account?.bank_name || 'N/A'}
                        </p>
                        <p className="text-sm mb-1">
                          <span className="font-medium">Account Number:</span> {request.host_bank_account?.account_last_four ? `••••${request.host_bank_account.account_last_four}` : 'N/A'}
                        </p>
                        <p className="text-sm mb-4">
                          <span className="font-medium">IFSC Code:</span> {request.host_bank_account?.ifsc_code || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between pt-4 border-t mt-4">
                      <div className="flex items-center space-x-4">
                        <p className="text-sm">
                          <span className="font-medium">Status:</span>
                          <Badge variant={request.status === 'paid' ? 'secondary' : request.status === 'rejected' ? 'destructive' : 'default'}>
                            {request.status}
                          </Badge>
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Requested:</span> {new Date(request.requested_at).toLocaleDateString()}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Paid:</span> {request.paid_at
                            ? new Date(request.paid_at).toLocaleDateString()
                            : '-'
                          }
                        </p>
                        {request.status === 'rejected' && request.notes && (
                          <p className="text-sm text-muted-foreground">
                            <span className="font-medium">Reason:</span> {request.notes}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 md:pt-0 flex items-center gap-2">
                        {request.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              disabled={approvingId === request.id || rejectingId === request.id}
                              onClick={() => handleApprovePayout(request.id)}
                            >
                              {approvingId === request.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Mark as Paid'
                              )}
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="border-destructive text-destructive hover:bg-destructive/10"
                                  disabled={approvingId === request.id || rejectingId === request.id}
                                >
                                  {rejectingId === request.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Reject'
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Reject this payout request?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    The host will be able to request a payout again later. Optionally give a reason -
                                    it's stored on the request and shown to you here, not to the host.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Textarea
                                  placeholder="Reason (optional)"
                                  value={rejectReasons[request.id] || ''}
                                  onChange={(e) => setRejectReasons(prev => ({ ...prev, [request.id]: e.target.value }))}
                                  className="min-h-[80px]"
                                />
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRejectPayout(request.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Reject payout
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}