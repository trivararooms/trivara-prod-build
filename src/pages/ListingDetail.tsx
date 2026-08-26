import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Star, Wifi, Car, Snowflake, Tv, Loader2, Home } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { listingService } from '@/services/listingService';
import { bookingService } from '@/services/bookingService';
import { availabilityService } from '@/services/availabilityService';
import { reviewService } from '@/services/reviewService';
import { profileService } from '@/services/profileService';
import { useAuth } from '@/hooks/useAuth';
import { formatINR } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { loadRazorpayScript } from '@/lib/loadRazorpayScript';
import { Listing, Review } from '@/types';

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

export default function ListingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkIn, setCheckIn] = useState<Date>();
  const [checkOut, setCheckOut] = useState<Date>();
  const [guests, setGuests] = useState(1);
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([]);
  const [isBooking, setIsBooking] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [host, setHost] = useState<{ first_name: string; last_name: string; avatar_url?: string } | null>(null);

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
          // Fetch reviews for the listing
          try {
            const reviewsData = await reviewService.getReviewsByListing(data.id);
            setReviews(reviewsData);
          } catch (error) {
            console.error('Error fetching reviews:', error);
            setReviews([]); // Set empty reviews on error
          }

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

        // bookingService.create() now refuses to create a booking at all
        // when Razorpay isn't configured (it returns success:false instead)
        // rather than confirming one with no payment behind it - so a
        // successful result here always means 'pending_payment', and
        // initiating Razorpay checkout is the only remaining step.
        const orderResult = await bookingService.createRazorpayOrder(booking.id);

        if (!orderResult.success || !orderResult.order) {
          throw new Error(orderResult.error || 'Failed to initialize payment');
        }

        // Checkout.js is no longer loaded on every page - fetch it now,
        // right before we actually need it.
        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) {
          throw new Error('Could not load the payment gateway. Check your connection and try again.');
        }

        const options = {
          key: orderResult.order.key_id,
          amount: orderResult.order.amount,
          currency: orderResult.order.currency,
          name: "TRIVARA",
          description: `Booking for ${listing.title}`,
          order_id: orderResult.order.id,
          handler: function () {
            // Webhook will handle the confirmation, but we can proactively notify
            toast({
              title: 'Payment successful',
              description: 'Your booking is being confirmed. Redirecting...',
            });
            navigate('/trips');
          },
          prefill: {
            name: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`,
            email: user.email,
          },
          theme: {
            color: "#4f46e5",
          },
          modal: {
            ondismiss: function () {
              setIsBooking(false);
              toast({
                title: 'Payment cancelled',
                description: 'You can try paying again from your trips page.',
                variant: 'default',
              });
            }
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
        return; // Don't navigate yet, wait for handler or modal close
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
        <div className="mb-6">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            {listing.title}
          </h1>
          <p className="text-text-secondary flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {listing.location?.city}, {listing.location?.state}, {listing.location?.country}
          </p>
          {host && (
            <p className="text-text-secondary mt-1">
              Hosted by {host.first_name} {host.last_name}
            </p>
          )}
        </div>

        {/* Image Gallery */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 mb-8">
          <div className="lg:col-span-2 lg:row-span-2">
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
          </div>
          {listing.photos && listing.photos.slice(1, 5).map((photo: string, index: number) => (
            <div key={index} className="aspect-square">
              <img
                src={photo}
                alt={`${listing.title} ${index + 2}`}
                className="w-full h-full object-cover rounded-lg"
              />
            </div>
          ))}
        </div>

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

            {/* Reviews */}
            <div className="mb-8">
              <h3 className="text-xl font-medium text-foreground mb-4">Reviews</h3>
              {reviews.length > 0 ? (
                <>
                  {/* Average Rating */}
                  <div className="flex items-center gap-2 mb-6">
                    <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                    <span className="text-lg font-medium text-foreground">
                      {reviews.length > 0
                        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
                        : '0.0'}
                    </span>
                    <span className="text-text-secondary">
                      ({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})
                    </span>
                  </div>

                  {/* Review List */}
                  <div className="space-y-6">
                    {reviews.map((review) => (
                      <div key={review.id} className="border-b border-border pb-6 last:border-b-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-2">
                          {/* Star rating display */}
                          <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${star <= review.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-text-secondary'
                                  }`}
                              />
                            ))}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-text-secondary text-sm mb-2">
                            {review.comment}
                          </p>
                        )}
                        <p className="text-xs text-text-meta">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ''}
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-text-secondary">No reviews yet</p>
              )}
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
                </div>

                {/* Guests */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Guests
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground"
                  >
                    {[...Array(listing.maxGuests)].map((_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {i + 1} {i === 0 ? 'guest' : 'guests'}
                      </option>
                    ))}
                  </select>
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
                    <div className="flex justify-between font-semibold">
                      <span className="text-foreground">Total</span>
                      <span className="text-foreground">{formatINR(pricing.total)}</span>
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
                      Booking...
                    </>
                  ) : user ? (
                    'Request to book'
                  ) : (
                    'Sign in to book'
                  )}
                </Button>

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
      </div>
    </div>
  );
}