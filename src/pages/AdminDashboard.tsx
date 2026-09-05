import { useEffect, useState, useRef, useCallback, type ComponentType } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
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
import {
  Loader2,
  RefreshCw,
  Settings,
  UserCheck,
  Home,
  CalendarCheck2,
  Activity,
  CheckCircle2,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { adminAccessService } from '@/services/adminAccessService';

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

function StatCard({
  icon: Icon,
  label,
  value,
  valueClassName = 'text-3xl font-semibold text-foreground',
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Icon className="h-6 w-6 text-accent" />
          </div>
          <div>
            <p className={valueClassName}>{value}</p>
            <p className="text-sm text-text-secondary">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

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
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const [refundAmounts, setRefundAmounts] = useState<Record<string, string>>({});
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

  const handleRefundBooking = async (request: PayoutRequest) => {
    if (!request.booking_id) return;
    const amount = Number(refundAmounts[request.id] ?? request.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast({ title: 'Error', description: 'Enter a valid refund amount.', variant: 'destructive' });
      return;
    }

    setRefundingId(request.id);
    try {
      const data = await adminAccessService.processRefund(
        request.booking_id,
        `manual-${request.booking_id}-${Date.now()}`,
        Math.round(amount),
      );

      if (data && data.success === false) {
        throw new Error(data.error || 'Failed to process refund');
      }

      toast({ title: 'Refund processed', description: data?.message || 'The booking has been refunded.' });
      setRefundAmounts(prev => {
        const next = { ...prev };
        delete next[request.id];
        return next;
      });

      await Promise.all([refreshStats(), refreshPayoutRequests()]);
    } catch (error: unknown) {
      console.error('Error processing refund:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to process refund.'),
        variant: 'destructive',
      });
    } finally {
      setRefundingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
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
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide text-foreground">
              Admin Dashboard
            </h1>
            <div className="mt-2 text-sm text-text-secondary flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Live updates enabled
              <span className="text-xs text-text-meta">• Last updated: {lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {profile?.role === 'admin' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/host-applications')}
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Host applications
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/admin/dashboard/settings')}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </>
            )}
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
          <StatCard icon={Home} label="Total Listings" value={stats?.total_listings || 0} />
          <StatCard icon={CalendarCheck2} label="Total Bookings" value={stats?.total_bookings || 0} />
          <StatCard icon={Activity} label="Active Bookings" value={stats?.active_bookings || 0} />
          <StatCard icon={CheckCircle2} label="Completed Bookings" value={stats?.completed_bookings || 0} />
          <StatCard
            icon={TrendingUp}
            label="Platform Revenue"
            value={formatINR(stats?.platform_revenue || 0)}
            valueClassName="text-3xl font-pillar font-bold text-accent"
          />
          <StatCard
            icon={Wallet}
            label="Pending Host Payouts"
            value={formatINR(stats?.pending_payouts || 0)}
            valueClassName="text-3xl font-pillar font-bold text-primary"
          />
        </div>

        {/* Payout Requests Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-pillar uppercase tracking-wide text-xl">Payout Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {(payoutRequests ?? []).length === 0 ? (
              <p className="text-sm text-text-secondary">No payout requests found.</p>
            ) : (
              <div className="space-y-4">
                {payoutRequests.map(request => (
                  <div key={request.id} className="rounded-lg border border-border bg-surface-1 p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        {/* Booking Context */}
                        <div className="mb-4 p-3 bg-surface-2 rounded-md">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-1">Booking Context</h4>
                          {request.bookings ? (
                            <>
                              <p className="text-sm"><span className="font-medium">Property:</span> {request.bookings.listings?.title || 'Unknown'}</p>
                              <p className="text-xs text-text-meta">Booking ID: {request.booking_id}</p>
                            </>
                          ) : (
                            <p className="text-sm text-text-secondary">General Payout Request (No Booking ID)</p>
                          )}
                        </div>

                        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Host Information</h4>
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
                          <span className="font-medium">Amount:</span>{' '}
                          <span className="font-pillar font-semibold text-accent">{formatINR(request.amount)}</span> ({request.currency})
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">Bank Details</h4>
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

                    <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border mt-4">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">Status:</span>
                          <Badge variant={request.status === 'paid' ? 'secondary' : request.status === 'rejected' ? 'destructive' : 'default'}>
                            {request.status}
                          </Badge>
                        </div>
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
                          <p className="text-sm text-text-secondary">
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
                        {request.status === 'paid' && request.booking_id && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-destructive text-destructive hover:bg-destructive/10"
                                disabled={refundingId === request.id}
                              >
                                {refundingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refund'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Refund this booking?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This marks the booking cancelled and refunded, and reverses its host earnings entry.
                                  It does not itself move money — record the amount you actually refunded.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <Input
                                type="number"
                                min="1"
                                placeholder="Refund amount"
                                value={refundAmounts[request.id] ?? String(request.amount)}
                                onChange={(e) => setRefundAmounts(prev => ({ ...prev, [request.id]: e.target.value }))}
                              />
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleRefundBooking(request)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Process refund
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}