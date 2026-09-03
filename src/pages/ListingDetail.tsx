import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Calendar, MapPin, Wifi, Car, Snowflake, Tv, Loader2, Home, BadgeCheck, ShieldCheck, Share2, X, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CounterInput } from '@/components/ui/CounterInput';
import { Checkbox } from '@/components/ui/checkbox';
import { ReviewsList } from '@/components/reviews/ReviewsList';
import { ListingCard } from '@/components/listings/ListingCard';
import { useToast } from '@/hooks/use-toast';
import { listingService } from '@/services/listingService';
import { bookingService } from '@/services/bookingService';
import { availabilityService } from '@/services/availabilityService';
import { profileService } from '@/services/profileService';
import { messageService } from '@/services/messageService';
import { calendarService, PriceOverride } from '@/services/calendarService';
import { useAuth } from '@/hooks/useAuth';
import { formatINR } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { payForBooking } from '@/lib/razorpayCheckout';
import { Listing } from '@/types';

interface PricingBreakdown {
  nights: number;
  subtotal: number;
  cleaningFee: number;
  serviceFee: number;
  total: number;
}

const amenitiesMap = {
  wifi: { icon: Wifi, label: 'WiFi' },
  parking: { icon: Car, label: 'Parking' },
  ac: { icon: Snowflake, label: 'Air conditioning' },
  tv: { icon: Tv, label: 'TV' },
};

/** Collapses adjacent same-price override dates into ranges for display, e.g. Dec 24-26 instead of three separate lines. */
function groupConsecutivePriceOverrides(overrides: PriceOverride[]): { start: Date; end: Date; price: number }[] {
  const sorted = [...overrides].sort((a, b) => a.date.getTime() - b.date.getTime());
  const groups: { start: Date; end: Date; price: number }[] = [];

  for (const override of sorted) {
    const last = groups[groups.length - 1];
    const oneDayAfterLast = last ? last.end.getTime() + 24 * 60 * 60 * 1000 : null;
    if (last && last.price === override.pricePerNight && oneDayAfterLast === override.date.getTime()) {
      last.end = override.date;
    } else {
      groups.push({ start: override.date, end: override.date, price: override.pricePerNight });
    }
  }

  return groups;
}

const cancellationPolicySummary: Record<Listing['cancellationPolicy'], string> = {
  flexible: 'full refund if you cancel at least 24 hours before check-in; no refund after that.',
  moderate: 'full refund if you cancel at least 5 days before check-in; 50% refund after that.',
  strict: '50% refund if you cancel at least 7 days before check-in; no refund after that.',
};

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [host, setHost] = useState<{ first_name: string; last_name: string; avatar_url?: string; is_verified?: boolean } | null>(null);
  const [similarListings, setSimilarListings] = useState<Listing[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<PriceOverride[]>([]);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  // Infants don't count against a listing's max-guest capacity (matches how
  // other OTAs treat them) - only adults + children do. Pets aren't part of
  // the guest count at all; `bringingPet` is guest-facing info only (there's
  // no pets_allowed column on bookings to persist it against).
  const guests = adults + children;
  const [infants, setInfants] = useState(0);
  const [bringingPet, setBringingPet] = useState(false);

  // Reusable function to fetch unavailable dates
  const fetchUnavailableDates = async (listingId: string) => {
    try {
      console.log('Fetching unavailable dates...');
      const unavailable = await availabilityService.getUnavailableDates(listingId);
      setUnavailableDates(unavailable);
      console.log(`Loaded ${unavailable.length} unavailable dates`);
    } catch (error) {
      console.error('Error fetching unavailable dates:', error);
      setUnavailableDates([]); // Reset to empty array on error
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) {
        // No id in the URL - nothing to fetch. Without this, `loading` (which
        // starts true) would never clear, and the page would show its
        // spinner forever instead of falling through to "Listing not found".
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        // Reset unavailable dates when fetching a new listing
        setUnavailableDates([]);

        const data = await listingService.getById(id);
        setListing(data);

        if (data) {
          // Fetch unavailable dates for the listing
          await fetchUnavailableDates(data.id);

          // Fetch host profile information (shown in the "Hosted by" line below)
          try {
            if (data.hostId) {
              const hostProfile = await profileService.getByUserId(data.hostId);
              setHost(hostProfile);
            }
          } catch (error) {
            console.error('Error fetching host profile:', error);
            // Silently handle host profile errors - listing detail should still render
          }

          // Similar stays in the same city - non-critical, failure shouldn't block the page
          try {
            const similar = await listingService.getSimilar(data);
            setSimilarListings(similar);
          } catch (error) {
            console.error('Error fetching similar listings:', error);
            setSimilarListings([]);
          }

          // Upcoming custom-priced dates (host-set overrides), for the
          // calendar-based price view.
          try {
            const overrides = await calendarService.getPriceOverrides(data.id);
            const upcoming = overrides.filter((o) => o.date >= new Date(new Date().setHours(0, 0, 0, 0)));
            setPriceOverrides(upcoming);
          } catch (error) {
            console.error('Error fetching price overrides:', error);
            setPriceOverrides([]);
          }
        }
      } catch (error) {
        console.error('Error fetching listing:', error);
        toast({
          title: 'Error',
          description: 'Failed to load listing details',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchListing();
  }, [id, toast]);

  // Refetch unavailable dates when returning to this listing after cancellation
  // This ensures the calendar updates immediately without page reload
  // Runs when id changes (navigating to/from this page)
  useEffect(() => {
    if (id && listing?.id === id) {
      fetchUnavailableDates(id);
    }
  }, [id, listing?.id]);

  useEffect(() => {
    const calculatePricing = async () => {
      if (!listing || !checkIn || !checkOut) {
        setPricing(null); // Reset pricing when dates are not selected
        return;
      }

      try {
        const pricingData = await availabilityService.calculateTotalPrice(
          listing.id,
          checkIn,
          checkOut,
          listing.pricePerNight,
          listing.cleaningFee,
          listing.serviceFee
        );
        setPricing(pricingData);
      } catch (error) {
        console.error('Error calculating pricing:', error);
        setPricing(null); // Reset pricing on error
      }
    };

    calculatePricing();
  }, [listing, checkIn, checkOut]);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: listing?.title, url });
      } catch {
        // User cancelled the share sheet - nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copied', description: 'Listing link copied to clipboard.' });
    } catch {
      toast({ title: 'Could not copy link', description: url, variant: 'destructive' });
    }
  };

  const handleSendMessage = async () => {
    if (!listing || !user?.id || !messageDraft.trim()) return;
    setSendingMessage(true);
    try {
      await messageService.startConversation(listing.id, user.id, listing.hostId, user.id, messageDraft.trim());
      toast({ title: 'Message sent', description: 'The host will get back to you soon.' });
      setMessageDraft('');
      setMessageOpen(false);
    } catch (error: unknown) {
      console.error('Error sending message:', error);
      toast({
        title: 'Could not send message',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const handleBook = async () => {
    if (!listing || !checkIn || !checkOut || !user?.id) return;

    setIsBooking(true);

    try {
      const bookingResult = await bookingService.create(
        listing.id,
        user.id,
        checkIn,
        checkOut,
        guests
      );

      console.log('Booking Result:', bookingResult);

      if (bookingResult.success && bookingResult.booking) {
        const booking = bookingResult.booking;

        if (bookingResult.requiresApproval) {
          // Request to Book: no payment yet - the host has to approve first.
          toast({
            title: 'Request sent',
            description: `${host?.first_name || 'The host'} will review your request. You'll be able to pay once it's approved.`,
          });
          navigate('/trips');
          return;
        }

        // Instant Book: bookingService.create() refuses to create a booking
        // at all when Razorpay isn't configured, so a successful result here
        // always means 'pending_payment' and initiating checkout is next.
        const result = await payForBooking({
          bookingId: booking.id,
          listingTitle: listing.title,
          userEmail: user.email,
          userName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`,
          onSuccess: () => {
            // Webhook will handle the confirmation, but we can proactively notify
            toast({
              title: 'Payment successful',
              description: 'Your booking is being confirmed. Redirecting...',
            });
            navigate('/trips');
          },
          onDismiss: () => {
            setIsBooking(false);
            toast({
              title: 'Payment cancelled',
              description: 'You can try paying again from your trips page.',
              variant: 'default',
            });
          },
        });

        if (!result.success) {
          throw new Error(result.error);
        }
        return; // Don't navigate yet, wait for the checkout's handler or modal close
      } else {
        toast({
          title: 'Booking failed',
          description: bookingResult.error || 'Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error: unknown) {
      console.error('Booking error:', error);
      toast({
        title: 'Booking failed',
        description: getErrorMessage(error, 'An error occurred. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsBooking(false);
    }
  };

  if (loading) {
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

  if (!listing) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-medium text-foreground mb-4">Listing not found</h1>
            <Button onClick={() => navigate('/search')}>Browse listings</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Title and Location */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-medium text-foreground mb-2">
              {listing.title}
            </h1>
            <p className="text-text-secondary flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {listing.location?.city}, {listing.location?.state}, {listing.location?.country}
            </p>
            {host && (
              <p className="text-text-secondary mt-1 flex items-center gap-1.5">
                Hosted by {host.first_name} {host.last_name}
                {host.is_verified && (
                  <Badge variant="secondary" className="gap-1 bg-surface-3 text-foreground">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified
                  </Badge>
                )}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            {user && listing.hostId !== user.id && (
              <Button variant="outline" size="sm" className="gap-2" onClick={() => setMessageOpen(true)}>
                <MessageCircle className="h-4 w-4" />
                Message host
              </Button>
            )}
          </div>
        </div>

        {/* Image Gallery */}
        <div className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
          <button
            type="button"
            className="lg:col-span-2 lg:row-span-2 block cursor-pointer"
            onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            disabled={!listing.photos?.[0]}
          >
            {listing.photos && listing.photos[0] ? (
              <img
                src={listing.photos[0]}
                alt={listing.title}
                className="w-full h-full object-cover rounded-lg"
              />
            ) : (
              <div className="w-full h-full bg-surface-2 rounded-lg flex items-center justify-center min-h-96">
                <div className="text-center text-text-secondary">
                  <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No image available</p>
                </div>
              </div>
            )}
          </button>
          {listing.photos && listing.photos.slice(1, 5).map((photo: string, index: number) => (
            <button
              type="button"
              key={index}
              className="aspect-square block cursor-pointer"
              onClick={() => { setGalleryIndex(index + 1); setGalleryOpen(true); }}
            >
              <img
                src={photo}
                alt={`${listing.title} ${index + 2}`}
                className="w-full h-full object-cover rounded-lg"
              />
            </button>
          ))}
          {listing.photos && listing.photos.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              className="absolute bottom-3 right-3 bg-background/90"
              onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            >
              Show all {listing.photos.length} photos
            </Button>
          )}
        </div>

        {/* Photo Lightbox */}
        <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
          <DialogContent className="max-w-4xl w-full bg-background p-0 overflow-hidden">
            {listing.photos && listing.photos.length > 0 && (
              <div className="relative bg-black/90 flex items-center justify-center h-[70vh]">
                <img
                  src={listing.photos[galleryIndex]}
                  alt={`${listing.title} ${galleryIndex + 1}`}
                  className="max-h-full max-w-full object-contain"
                />
                {listing.photos.length > 1 && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i - 1 + listing.photos.length) % listing.photos.length)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGalleryIndex((i) => (i + 1) % listing.photos.length)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 hover:bg-background flex items-center justify-center"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white bg-black/60 px-2 py-1 rounded-full">
                      {galleryIndex + 1} / {listing.photos.length}
                    </span>
                  </>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Message host */}
        <Dialog open={messageOpen} onOpenChange={setMessageOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Message {host ? host.first_name : 'the host'}</DialogTitle>
            </DialogHeader>
            <Textarea
              value={messageDraft}
              onChange={(e) => setMessageDraft(e.target.value)}
              placeholder={`Hi${host ? ' ' + host.first_name : ''}, I have a question about ${listing.title}...`}
              className="min-h-32"
            />
            <DialogFooter>
              <Button onClick={handleSendMessage} disabled={sendingMessage || !messageDraft.trim()}>
                {sendingMessage ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Send message
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="mb-8">
              <h2 className="text-2xl font-medium text-foreground mb-4">About this place</h2>
              <p className="text-text-secondary leading-relaxed">{listing.description}</p>
            </div>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-medium text-foreground mb-4">What this place offers</h3>
                <div className="grid grid-cols-2 gap-4">
                  {listing.amenities.map((amenity: string) => {
                    const amenityInfo = amenitiesMap[amenity as keyof typeof amenitiesMap];
                    if (!amenityInfo) return null;

                    const Icon = amenityInfo.icon;
                    return (
                      <div key={amenity} className="flex items-center gap-3">
                        <Icon className="h-5 w-5 text-accent" />
                        <span className="text-foreground">{amenityInfo.label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* House Rules */}
            {listing.houseRules && listing.houseRules.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xl font-medium text-foreground mb-4">House rules</h3>
                <ul className="space-y-2">
                  {listing.houseRules.map((rule: string, index: number) => (
                    <li key={index} className="text-text-secondary flex items-start gap-2">
                      <span className="text-accent mt-1">•</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cancellation Policy */}
            <div className="mb-8">
              <h3 className="text-xl font-medium text-foreground mb-4 flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-accent" />
                Cancellation policy
              </h3>
              <p className="text-text-secondary leading-relaxed">
                <span className="font-medium text-foreground capitalize">{listing.cancellationPolicy}</span>
                {': '}
                {cancellationPolicySummary[listing.cancellationPolicy]}{' '}
                <Link to="/cancellation-options" className="underline underline-offset-2 hover:text-foreground">
                  Learn more
                </Link>
              </p>
            </div>

            {/* Reviews */}
            <div className="mb-8">
              <ReviewsList listingId={listing.id} />
            </div>
          </div>

          {/* Booking Panel */}
          <div className="lg:col-span-1">
            <Card className="bg-card border-border sticky top-24">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl font-semibold text-foreground">
                    {formatINR(listing.pricePerNight)}
                  </span>
                  <span className="text-text-secondary">night</span>
                </div>

                {/* Calendar */}
                <div className="mb-4 static">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Dates
                  </label>
                  <CalendarComponent
                    mode="range"
                    selected={{ from: checkIn, to: checkOut }}
                    onSelect={(range) => {
                      setCheckIn(range?.from);
                      setCheckOut(range?.to);
                    }}
                    disabled={(date) => {
                      if (date < new Date()) return true;
                      if (unavailableDates && unavailableDates.length > 0 &&
                        unavailableDates.some(d => d.toDateString() === date.toDateString())) return true;
                      return false;
                    }}
                    className="rounded-lg border border-border shadow-none"
                  />
                  {priceOverrides.length > 0 && (
                    <div className="mt-2 text-xs text-text-meta space-y-0.5">
                      <p className="font-medium text-text-secondary">Custom pricing on select dates:</p>
                      {groupConsecutivePriceOverrides(priceOverrides).map((group) => (
                        <p key={group.start.toISOString()}>
                          {group.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          {group.end.getTime() !== group.start.getTime()
                            && ` - ${group.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`}
                          : {formatINR(group.price)}/night
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Guests */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Guests
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full text-left rounded-lg border border-border bg-background px-3 py-2 text-foreground hover:bg-surface-2 trivara-transition"
                      >
                        {guests} {guests === 1 ? 'guest' : 'guests'}
                        {infants > 0 && `, ${infants} ${infants === 1 ? 'infant' : 'infants'}`}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 bg-card border-border space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Adults</p>
                          <p className="text-xs text-text-meta">Ages 13+</p>
                        </div>
                        <CounterInput
                          value={adults}
                          onChange={(v) => setAdults(Math.min(v, listing.maxGuests - children))}
                          min={1}
                          max={Math.max(1, listing.maxGuests - children)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Children</p>
                          <p className="text-xs text-text-meta">Ages 2-12</p>
                        </div>
                        <CounterInput
                          value={children}
                          onChange={(v) => setChildren(Math.min(v, listing.maxGuests - adults))}
                          min={0}
                          max={Math.max(0, listing.maxGuests - adults)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">Infants</p>
                          <p className="text-xs text-text-meta">Under 2 · doesn't count toward capacity</p>
                        </div>
                        <CounterInput value={infants} onChange={setInfants} min={0} max={5} />
                      </div>
                      <label className="flex items-center justify-between pt-3 border-t border-border cursor-pointer">
                        <span className="text-sm font-medium">Bringing a pet?</span>
                        <Checkbox checked={bringingPet} onCheckedChange={(checked) => setBringingPet(!!checked)} />
                      </label>
                      {bringingPet && !listing.amenities.includes('pets_allowed') && (
                        <p className="text-xs text-destructive">
                          This listing isn't marked pet-friendly - message the host before booking.
                        </p>
                      )}
                    </PopoverContent>
                  </Popover>
                  <p className="text-xs text-text-meta mt-1">This place has a maximum of {listing.maxGuests} guests (not counting infants)</p>
                </div>

                {/* Pricing Breakdown */}
                {pricing && (
                  <div className="mb-6 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">
                        {formatINR(listing.pricePerNight)} × {pricing.nights} nights
                      </span>
                      <span className="text-foreground">{formatINR(pricing.subtotal)}</span>
                    </div>
                    {listing.cleaningFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Cleaning fee</span>
                        <span className="text-foreground">{formatINR(listing.cleaningFee)}</span>
                      </div>
                    )}
                    {listing.serviceFee > 0 && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Service fee</span>
                        <span className="text-foreground">{formatINR(listing.serviceFee)}</span>
                      </div>
                    )}
                    <hr className="border-border my-2" />
                    <div className="flex justify-between items-baseline font-pillar font-bold uppercase tracking-wide text-base">
                      <span className="text-foreground">Total</span>
                      <span className="text-accent">{formatINR(pricing.total)}</span>
                    </div>
                  </div>
                )}

                {/* Book Button */}
                <Button
                  className="w-full bg-accent text-accent-foreground hover:bg-accent-hover"
                  disabled={!checkIn || !checkOut || !user || isBooking}
                  onClick={handleBook}
                >
                  {isBooking ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {listing.instantBook ? 'Booking...' : 'Sending request...'}
                    </>
                  ) : user ? (
                    listing.instantBook ? 'Reserve' : 'Request to book'
                  ) : (
                    'Sign in to book'
                  )}
                </Button>
                <p className="text-xs text-text-meta text-center mt-2">
                  {listing.instantBook
                    ? 'Instant Book - pay now, no host approval needed.'
                    : 'Request to Book - the host reviews your request before you pay.'}
                </p>

                {!user && (
                  <p className="text-xs text-text-secondary text-center mt-2">
                    You must be signed in to make a booking
                  </p>
                )}

                {user && (!checkIn || !checkOut) && (
                  <p className="text-xs text-text-secondary text-center mt-2">
                    Please select check-in and check-out dates
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Similar Stays */}
        {similarListings.length > 0 && (
          <div className="mt-12 pt-8 border-t border-border">
            <h2 className="text-2xl font-medium text-foreground mb-6">Similar stays</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {similarListings.map((similar) => (
                <ListingCard key={similar.id} listing={similar} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}