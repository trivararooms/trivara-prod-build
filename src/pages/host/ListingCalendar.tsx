import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Loader2, Trash2, Ban, Tag } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { listingService } from '@/services/listingService';
import { calendarService, BlackoutDate, PriceOverride } from '@/services/calendarService';
import { getErrorMessage } from '@/lib/errors';
import { formatINR } from '@/lib/utils';
import { Listing } from '@/types';

/**
 * Host-only page for two things a host previously had no way to do at all:
 * block off dates for personal use (blackout dates), and set a custom price
 * for specific dates (price overrides) - see 00000000000005_... migration.
 * HostDashboard.tsx used to link to /host/manage-calendar/:id for this and
 * the link was removed because the route never existed; this is that page,
 * built for real this time.
 */
export default function ListingCalendar() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { toast } = useToast();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [blackouts, setBlackouts] = useState<BlackoutDate[]>([]);
  const [overrides, setOverrides] = useState<PriceOverride[]>([]);

  const [blackoutRange, setBlackoutRange] = useState<{ from?: Date; to?: Date }>({});
  const [blackoutReason, setBlackoutReason] = useState('');
  const [savingBlackout, setSavingBlackout] = useState(false);

  const [priceRange, setPriceRange] = useState<{ from?: Date; to?: Date }>({});
  const [customPrice, setCustomPrice] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    if (!id || !user?.id) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [listingData, blackoutData, overrideData] = await Promise.all([
          listingService.getById(id),
          calendarService.getBlackoutDates(id),
          calendarService.getPriceOverrides(id),
        ]);
        if (cancelled) return;
        setListing(listingData ?? null);
        setBlackouts(blackoutData);
        setOverrides(overrideData);
      } catch (error) {
        if (!cancelled) {
          toast({ title: 'Error', description: getErrorMessage(error, 'Could not load this listing.'), variant: 'destructive' });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id, user?.id]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!listing || listing.hostId !== user.id) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-medium mb-4">Listing not found</h1>
          <Button onClick={() => navigate('/host/dashboard')}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const handleAddBlackout = async () => {
    if (!blackoutRange.from || !blackoutRange.to) return;
    setSavingBlackout(true);
    try {
      const result = await calendarService.addBlackoutDate(
        listing.id, user.id, blackoutRange.from, blackoutRange.to, blackoutReason || undefined
      );
      if (!result.success) throw new Error(result.error);
      setBlackouts(await calendarService.getBlackoutDates(listing.id));
      setBlackoutRange({});
      setBlackoutReason('');
      toast({ title: 'Dates blocked', description: 'Guests will no longer be able to book these dates.' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Could not block these dates.'), variant: 'destructive' });
    } finally {
      setSavingBlackout(false);
    }
  };

  const handleRemoveBlackout = async (blackoutId: string) => {
    if (await calendarService.removeBlackoutDate(blackoutId)) {
      setBlackouts((prev) => prev.filter((b) => b.id !== blackoutId));
    }
  };

  const handleAddPriceOverride = async () => {
    const price = Number(customPrice);
    if (!priceRange.from || !priceRange.to || !price || price <= 0) return;
    setSavingPrice(true);
    try {
      const result = await calendarService.setPriceOverrideRange(
        listing.id, user.id, priceRange.from, priceRange.to, price
      );
      if (!result.success) throw new Error(result.error);
      setOverrides(await calendarService.getPriceOverrides(listing.id));
      setPriceRange({});
      setCustomPrice('');
      toast({ title: 'Custom pricing saved' });
    } catch (error: unknown) {
      toast({ title: 'Error', description: getErrorMessage(error, 'Could not save custom pricing.'), variant: 'destructive' });
    } finally {
      setSavingPrice(false);
    }
  };

  const handleRemovePriceOverride = async (overrideId: string) => {
    if (await calendarService.removePriceOverride(overrideId)) {
      setOverrides((prev) => prev.filter((o) => o.id !== overrideId));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-pillar font-bold uppercase tracking-wide text-foreground mb-2">Calendar</h1>
          <p className="text-text-secondary">Manage blocked dates and custom pricing for {listing.title}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Blackout dates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Ban className="h-5 w-5" /> Blocked dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CalendarComponent
                mode="range"
                selected={{ from: blackoutRange.from, to: blackoutRange.to }}
                onSelect={(range) => setBlackoutRange({ from: range?.from, to: range?.to })}
                disabled={(date) => date < new Date()}
                className="rounded-lg border border-border"
              />
              <Input
                placeholder="Reason (optional, e.g. personal use)"
                value={blackoutReason}
                onChange={(e) => setBlackoutReason(e.target.value)}
              />
              <Button
                className="w-full"
                disabled={!blackoutRange.from || !blackoutRange.to || savingBlackout}
                onClick={handleAddBlackout}
              >
                {savingBlackout ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Block these dates'}
              </Button>

              <div className="space-y-2 pt-4 border-t border-border">
                {blackouts.length === 0 ? (
                  <p className="text-sm text-text-secondary">No blocked dates yet.</p>
                ) : blackouts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface-1">
                    <span>
                      {b.startDate.toLocaleDateString()} - {b.endDate.toLocaleDateString()}
                      {b.reason && <span className="text-text-secondary"> ({b.reason})</span>}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveBlackout(b.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Price overrides */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg"><Tag className="h-5 w-5" /> Custom pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CalendarComponent
                mode="range"
                selected={{ from: priceRange.from, to: priceRange.to }}
                onSelect={(range) => setPriceRange({ from: range?.from, to: range?.to })}
                disabled={(date) => date < new Date()}
                className="rounded-lg border border-border"
              />
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary">₹</span>
                <Input
                  type="number"
                  placeholder={`Default: ${listing.pricePerNight}`}
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="pl-7"
                />
              </div>
              <Button
                className="w-full"
                disabled={!priceRange.from || !priceRange.to || !customPrice || savingPrice}
                onClick={handleAddPriceOverride}
              >
                {savingPrice ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Set price for these dates'}
              </Button>

              <div className="space-y-2 pt-4 border-t border-border max-h-64 overflow-y-auto">
                {overrides.length === 0 ? (
                  <p className="text-sm text-text-secondary">No custom pricing set - every date uses {formatINR(listing.pricePerNight)}/night.</p>
                ) : overrides.map((o) => (
                  <div key={o.id} className="flex items-center justify-between text-sm p-2 rounded-lg bg-surface-1">
                    <span>{o.date.toLocaleDateString()}: {formatINR(o.pricePerNight)}</span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemovePriceOverride(o.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
