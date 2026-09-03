import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { earningsService, HostEarning } from '@/services/earningsService';
import { payoutService, PayoutRequest } from '@/services/payoutService';
import { formatINR } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

async function fetchEarningsData(hostId: string) {
  // Fetch earnings directly from host_earnings table (single source of truth)
  const earnings = await earningsService.getHostEarnings(hostId);
  const payouts = await payoutService.getHostPayoutRequests(hostId);

  // Create a Set of booking IDs that have already been requested
  // We check for 'booking_id' in payout requests.
  // Note: Legacy payout requests might not have booking_id, so this logic applies to new flow.
  const requestedBookingIds = new Set(
    payouts
      .map((p) => p.booking_id)
      .filter((bookingId): bookingId is string => !!bookingId)
  );

  // Calculate totals
  let payable = 0;
  let paid = 0;
  let pending = 0;

  earnings.forEach(e => {
    if (e.status === 'paid') {
      paid += e.net_amount;
    } else if (e.status === 'pending') {
      pending += e.net_amount;
      // Eligible if pending AND not already requested
      if (!requestedBookingIds.has(e.booking_id)) {
        payable += e.net_amount;
      }
    }
  });

  return { earnings, payouts, payableTotal: payable, paidTotal: paid, pendingTotal: pending };
}

export default function HostEarnings() {
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const earningsQuery = useQuery({
    queryKey: ['host-earnings', user?.id],
    queryFn: () => fetchEarningsData(user!.id),
    enabled: !!user?.id,
  });

  const earnings = earningsQuery.data?.earnings ?? [];
  const payouts = earningsQuery.data?.payouts ?? [];
  const payableTotal = earningsQuery.data?.payableTotal ?? 0;
  const paidTotal = earningsQuery.data?.paidTotal ?? 0;
  const pendingTotal = earningsQuery.data?.pendingTotal ?? 0;

  const requestPayoutMutation = useMutation({
    mutationFn: (earning: HostEarning) => payoutService.requestPayout(earning.booking_id),
    onSuccess: (_data, earning) => {
      toast({
        title: "Payout Requested",
        description: `Payout request for ${formatINR(earning.net_amount)} has been submitted.`,
      });
      queryClient.invalidateQueries({ queryKey: ['host-earnings', user?.id] });
    },
    onError: (error: unknown) => {
      console.error('Error requesting payout:', error);
      toast({
        title: "Request Failed",
        description: getErrorMessage(error, "Failed to request payout. Please try again."),
        variant: "destructive"
      });
    },
  });

  // Filter earnings that are eligible for payout (Pending status AND not already requested)
  const eligibleEarnings = earnings.filter(e => {
    const isRequested = payouts.some((p) => p.booking_id === e.booking_id);
    return e.status === 'pending' && !isRequested;
  });

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

  // This page is already wrapped in <ProtectedRoute>, so `user` should always
  // be set by the time we get here - but gating on authLoading/!user first
  // (rather than trusting the query alone) matters because react-query's
  // `isPending` stays true forever for a *disabled* query (enabled: !!user?.id
  // false), so without this a missing user would show this spinner forever
  // instead of ever resolving.
  if (earningsQuery.isPending) {
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

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide mb-6">
          Earnings
        </h1>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Total Earnings</p>
              <p className="text-2xl font-pillar font-bold text-accent">{formatINR(pendingTotal + paidTotal)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Pending Earnings</p>
              <p className="text-2xl font-pillar font-bold text-primary">{formatINR(pendingTotal)}</p>
              <p className="text-xs text-text-meta mt-1">Eligible for payment: {formatINR(payableTotal)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-text-secondary">Paid Out</p>
              <p className="text-2xl font-pillar font-bold text-foreground">{formatINR(paidTotal)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Eligible for Payout Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Eligible for Payout</CardTitle>
          </CardHeader>
          <CardContent>
            {eligibleEarnings.length === 0 ? (
              <p className="text-sm text-text-secondary">No earnings currently eligible for payout.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Booking Date</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eligibleEarnings.map(e => {
                    const hasActivePayout = payouts.some((p) => p.status === 'pending' || p.status === 'processing');
                    const isRequestingThisOne =
                      requestPayoutMutation.isPending &&
                      requestPayoutMutation.variables?.booking_id === e.booking_id;

                    return (
                      <TableRow key={e.booking_id}>
                        <TableCell>
                          <div className="font-medium">{e.listing_title || 'Unknown Property'}</div>
                          <div className="text-xs text-muted-foreground">Booking ID: {e.booking_id.split('-')[0]}...</div>
                        </TableCell>
                        <TableCell>
                          {new Date(e.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatINR(e.net_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={() => requestPayoutMutation.mutate(e)}
                            disabled={isRequestingThisOne || hasActivePayout}
                            title={hasActivePayout ? "You already have a pending payout request" : "Request Payout"}
                          >
                            {isRequestingThisOne ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Request Payout
                          </Button>
                          {hasActivePayout && (
                            <p className="text-[10px] text-destructive mt-1">Pending Request Exists</p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Transaction History (Payout Requests) */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
          </CardHeader>
          <CardContent>
            {payouts.length === 0 ? (
              <p className="text-sm text-text-secondary">
                No payout requests yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Booking / Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Requested On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>
                        {p.bookings ? (
                          <>
                            <div className="font-medium">{p.bookings.listings?.title || 'Unknown Property'}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(p.bookings.start_date).toLocaleDateString()} - {new Date(p.bookings.end_date).toLocaleDateString()}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">General Payout Request</span>
                        )}
                      </TableCell>
                      <TableCell>{formatINR(p.amount)}</TableCell>
                      <TableCell>
                        <Badge variant={p.status === 'paid' ? 'default' : p.status === 'rejected' ? 'destructive' : 'secondary'}>{p.status}</Badge>
                        {p.status === 'rejected' && p.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{p.notes}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(p.requested_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Earnings Ledger</CardTitle>
          </CardHeader>
          <CardContent>
            {earnings.length === 0 ? (
              <p className="text-sm text-text-secondary">No earnings yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Gross</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {earnings.map(e => (
                    <TableRow key={e.booking_id}>
                      <TableCell>
                        <div>{e.listing_title || 'Unknown Property'}</div>
                        <div className="text-sm text-muted-foreground">
                          Booking ID: {e.booking_id.substring(0, 8)}...
                        </div>
                      </TableCell>
                      <TableCell>{formatINR(e.gross_amount)}</TableCell>
                      <TableCell>{formatINR(e.platform_fee)}</TableCell>
                      <TableCell className="font-medium">
                        {formatINR(e.net_amount)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const payoutRequest = payouts.find((p) => p.booking_id === e.booking_id);
                          const isProcessing = payoutRequest && payoutRequest.status === 'pending';
                          const isPaidOut = payoutRequest && payoutRequest.status === 'paid';

                          // Prioritize actual payout status if ledger sync missed it
                          const displayStatus = e.status === 'paid' || isPaidOut ? 'Paid' : (isProcessing ? 'Processing' : 'Pending');
                          const badgeVariant = displayStatus === 'Paid' ? 'secondary' : (displayStatus === 'Processing' ? 'outline' : 'default');

                          return (
                            <>
                              <Badge variant={badgeVariant}>
                                {displayStatus}
                              </Badge>
                              {e.status === 'pending' && !isProcessing && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Available: Immediately
                                </div>
                              )}
                              {isProcessing && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Payout Requested
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {new Date(e.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}