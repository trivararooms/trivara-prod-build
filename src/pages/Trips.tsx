import { useState, useEffect } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Calendar, MapPin, Star, Loader2, Home, X } from 'lucide-react';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { bookingService } from '@/services/bookingService';
import { listingService } from '@/services/listingService';
import { reviewService } from '@/services/reviewService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { formatINR } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';
import { payForBooking } from '@/lib/razorpayCheckout';
import { ReviewCategoryRatings } from '@/types';

interface BookingWithListing {
  booking: {
    id: string;
    listingId: string;
    guestId: string;
    hostId: string;
    checkIn: Date;
    checkOut: Date;
    guests: number;
    totalPrice: number;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  };
  listing?: {
    id: string;
    title: string;
    location?: {
      city?: string;
      state?: string;
    };
    photos?: string[];
  };
}

interface ReviewModalProps {
  booking: BookingWithListing['booking'];
  listing: BookingWithListing['listing'];
  onClose: () => void;
  onSubmit: (bookingId: string, rating: number, comment?: string, categories?: ReviewCategoryRatings) => Promise<void>;
  submitting: boolean;
}

const REVIEW_CATEGORIES: { key: keyof ReviewCategoryRatings; label: string }[] = [
  { key: 'cleanliness', label: 'Cleanliness' },
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'communication', label: 'Communication' },
  { key: 'value', label: 'Value' },
  { key: 'location', label: 'Location' },
];

function MiniStarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className="focus:outline-none"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
        >
          <Star className={`h-4 w-4 ${star <= (hovered || value) ? 'fill-yellow-400 text-yellow-400' : 'text-text-secondary'}`} />
        </button>
      ))}
    </div>
  );
}

function ReviewModal({ booking, listing, onClose, onSubmit, submitting }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [categories, setCategories] = useState<ReviewCategoryRatings>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) return;
    await onSubmit(booking.id, rating, comment || undefined, categories);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave a review</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-text-secondary mb-4">
            How was your stay at {listing?.title || 'this property'}?
          </div>
          
          {/* Star Rating */}
          <div className="flex gap-2 justify-center mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="focus:outline-none transition-transform hover:scale-110"
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`h-8 w-8 ${
                    star <= (hoveredRating || rating)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-text-secondary'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Category breakdown - all optional, purely a display refinement on top of the overall rating above */}
          <div className="space-y-2 border-y border-border py-4">
            {REVIEW_CATEGORIES.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-sm text-text-secondary">{label}</span>
                <MiniStarInput
                  value={categories[key] || 0}
                  onChange={(v) => setCategories((prev) => ({ ...prev, [key]: v }))}
                />
              </div>
            ))}
          </div>

          {/* Comment */}
          <Textarea
            placeholder="Share your experience (optional)"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="min-h-[100px] bg-surface-2 border-border"
          />
          
          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={rating === 0 || submitting}
              className="bg-accent text-accent-foreground hover:bg-accent-hover"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Review'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Trips() {
  const { toast } = useToast();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [reviewingBooking, setReviewingBooking] = useState<BookingWithListing['booking'] | null>(null);
  const [reviewingListing, setReviewingListing] = useState<BookingWithListing['listing'] | null>(null);
  const [reviewedBookings, setReviewedBookings] = useState<Set<string>>(new Set());
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [payingBookingId, setPayingBookingId] = useState<string | null>(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  
  const [upcomingBookings, setUpcomingBookings] = useState<BookingWithListing[]>([]);
  const [pastBookings, setPastBookings] = useState<BookingWithListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If auth hasn't resolved yet, or there's no logged-in user, don't fetch
    // - the render logic below shows an auth spinner / redirects to /login
    // in those cases without ever consulting `loading`. Without this guard,
    // a logged-out visitor would never reach that redirect: `loading` starts
    // `true`, nothing here would ever call setLoading(false), and the page
    // would show its own spinner forever instead.
    if (authLoading || !user?.id) return;

    const fetchBookings = async () => {
      try {
        setLoading(true);

        // Past bookings are now flipped to 'completed' by a server-side
        // scheduled job (see supabase/migrations) rather than client-triggered
        // here on every page load.

        // Fetch upcoming bookings
        const upcoming = await bookingService.getUpcomingByGuestId(user.id);
        const upcomingWithListings = await Promise.all(
          upcoming.map(async (booking) => {
            const listing = await listingService.getById(booking.listingId);
            return { booking, listing };
          })
        );
        setUpcomingBookings(upcomingWithListings);

        // Fetch past bookings
        const past = await bookingService.getPastByGuestId(user.id);
        
        // Check which bookings have been reviewed
        const reviewedIds = new Set<string>();
        for (const booking of past) {
          const hasReviewed = await reviewService.hasReviewedBooking(booking.id);
          if (hasReviewed) {
            reviewedIds.add(booking.id);
          }
        }
        setReviewedBookings(reviewedIds);

        const pastWithListings = await Promise.all(
          past.map(async (booking) => {
            const listing = await listingService.getById(booking.listingId);
            return { booking, listing };
          })
        );
        setPastBookings(pastWithListings);

      } catch (error) {
        console.error('Error fetching bookings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load your trips. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [authLoading, user?.id, toast]);

  const handleReviewSubmit = async (
    bookingId: string,
    rating: number,
    comment?: string,
    categories?: ReviewCategoryRatings
  ) => {
    setSubmittingReview(true);
    try {
      await reviewService.createReview(bookingId, rating, comment, categories);
      toast({
        title: 'Review submitted',
        description: 'Thank you for your review!',
      });
      setReviewedBookings(prev => new Set([...Array.from(prev), bookingId]));
      setReviewingBooking(null);
      setReviewingListing(null);
    } catch (error: unknown) {
      console.error('Error submitting review:', error);
      toast({
        title: 'Error',
        description: getErrorMessage(error, 'Failed to submit review. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const openReviewModal = (booking: BookingWithListing['booking'], listing?: BookingWithListing['listing']) => {
    setReviewingBooking(booking);
    setReviewingListing(listing || null);
  };

  const handlePayNow = async (
    booking: BookingWithListing['booking'],
    listing: BookingWithListing['listing']
  ) => {
    if (!user) return;
    setPayingBookingId(booking.id);
    try {
      const result = await payForBooking({
        bookingId: booking.id,
        listingTitle: listing?.title || 'your stay',
        userEmail: user.email,
        userName: `${user.user_metadata?.first_name || ''} ${user.user_metadata?.last_name || ''}`,
        onSuccess: () => {
          toast({
            title: 'Payment successful',
            description: 'Your booking is being confirmed. Redirecting...',
          });
          setPayingBookingId(null);
          navigate(`/bookings/${booking.id}/confirmation`);
        },
        onDismiss: () => {
          setPayingBookingId(null);
        },
      });
      if (!result.success) {
        throw new Error(result.error);
      }
    } catch (error: unknown) {
      console.error('Error opening checkout:', error);
      toast({
        title: 'Could not start payment',
        description: getErrorMessage(error, 'Please try again.'),
        variant: 'destructive',
      });
      setPayingBookingId(null);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingBookingId(bookingId);
    try {
      const result = await bookingService.cancelBooking(bookingId);
      if (result.success) {
        toast({
          title: 'Booking cancelled',
          description: result.refunded
            ? 'Your booking has been cancelled, your payment was refunded, and the dates are now available.'
            : 'Your booking has been cancelled and the dates are now available.',
        });
        // Remove the cancelled booking from the UI
        setUpcomingBookings(prev => prev.filter(({ booking }) => booking.id !== bookingId));
      } else {
        toast({
          title: 'Cancellation failed',
          description: result.error || 'Could not cancel the booking. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while cancelling the booking.',
        variant: 'destructive',
      });
    } finally {
      setCancellingBookingId(null);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-medium text-foreground mb-2">
            Your Trips
          </h1>
          <p className="text-text-secondary">
            Manage your upcoming and past stays
          </p>
        </div>

        <Tabs defaultValue="upcoming" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="past">Past</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {upcomingBookings.length > 0 ? (
              <div className="grid gap-6">
                {upcomingBookings.map(({ booking, listing }) => (
                  <div key={booking.id} className="bg-card rounded-xl overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-3">
                      <div className="aspect-video md:aspect-[4/3]">
                        {listing?.photos && listing.photos[0] ? (
                          <img 
                            src={listing.photos[0]} 
                            alt={listing.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                            <Home className="h-12 w-12 text-text-secondary" />
                          </div>
                        )}
                      </div>
                      <div className="md:col-span-2 p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-xl font-medium mb-1">{listing?.title}</h3>
                            <p className="text-text-secondary flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {listing?.location?.city}, {listing?.location?.state}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm ${
                            booking.status === 'confirmed'
                              ? 'bg-accent/20 text-accent-foreground'
                              : booking.status === 'completed'
                                ? 'bg-surface-3 text-foreground'
                                : booking.status === 'pending' || booking.status === 'pending_payment'
                                  ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400'
                                  : 'bg-destructive/20 text-destructive-foreground'
                          }`}>
                            {booking.status === 'pending' ? 'Awaiting host approval'
                              : booking.status === 'pending_payment' ? 'Payment required'
                              : booking.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                          <div>
                            <p className="text-text-secondary">Check-in</p>
                            <p className="font-medium">{new Date(booking.checkIn).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Check-out</p>
                            <p className="font-medium">{new Date(booking.checkOut).toLocaleDateString()}</p>
                          </div>
                          <div>
                            <p className="text-text-secondary">Guests</p>
                            <p className="font-medium">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</p>
                          </div>
                          <div>
                            <p className="text-text-secondary">{booking.status === 'confirmed' || booking.status === 'completed' ? 'Total paid' : 'Total due'}</p>
                            <p className="font-medium">{formatINR(booking.totalPrice)}</p>
                          </div>
                        </div>

                        {booking.status === 'pending_payment' && (
                          <div className="flex gap-3 flex-wrap mb-3">
                            <Button
                              className="bg-accent text-accent-foreground hover:bg-accent-hover"
                              disabled={payingBookingId === booking.id}
                              onClick={() => handlePayNow(booking, listing)}
                            >
                              {payingBookingId === booking.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Opening checkout...
                                </>
                              ) : (
                                'Pay now'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              disabled={cancellingBookingId === booking.id}
                              onClick={() => handleCancelBooking(booking.id)}
                            >
                              {cancellingBookingId === booking.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Cancel'
                              )}
                            </Button>
                          </div>
                        )}
                        {booking.status === 'pending' && (
                          <div className="flex gap-3 flex-wrap mb-3">
                            <Button
                              variant="outline"
                              className="border-destructive text-destructive hover:bg-destructive/10"
                              disabled={cancellingBookingId === booking.id}
                              onClick={() => handleCancelBooking(booking.id)}
                            >
                              {cancellingBookingId === booking.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                'Withdraw request'
                              )}
                            </Button>
                          </div>
                        )}

                        <div className="flex gap-3 flex-wrap">
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/listing/${listing?.id}`)}
                          >
                            View listing
                          </Button>
                          {(booking.status === 'confirmed' || booking.status === 'completed') && (
                            <Button
                              variant="outline"
                              onClick={() => navigate(`/bookings/${booking.id}/confirmation`)}
                            >
                              View confirmation
                            </Button>
                          )}
                          {booking.status === 'confirmed' && new Date() < new Date(booking.checkIn) && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button 
                                  variant="outline"
                                  className="border-destructive text-destructive hover:bg-destructive/10"
                                  disabled={cancellingBookingId === booking.id}
                                >
                                  {cancellingBookingId === booking.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Cancelling...
                                    </>
                                  ) : (
                                    'Cancel booking'
                                  )}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Cancel this booking?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to cancel your booking for {listing?.title}?
                                    Your payment will be refunded and the dates will be released for other guests.
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
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No upcoming trips</h3>
                <p className="text-text-secondary mb-6">Start planning your next adventure</p>
                <Button onClick={() => navigate('/search')}>
                  Explore listings
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastBookings.length > 0 ? (
              <div className="grid gap-6">
                {pastBookings.map(({ booking, listing }) => {
                  const canReview = booking.status === 'completed' && !reviewedBookings.has(booking.id);
                  
                  return (
                    <div key={booking.id} className="bg-card rounded-xl overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-3">
                        <div className="aspect-video md:aspect-[4/3]">
                          {listing?.photos && listing.photos[0] ? (
                            <img 
                              src={listing.photos[0]} 
                              alt={listing.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-surface-2 flex items-center justify-center">
                              <Home className="h-12 w-12 text-text-secondary" />
                            </div>
                          )}
                        </div>
                        <div className="md:col-span-2 p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-xl font-medium mb-1">{listing?.title}</h3>
                              <p className="text-text-secondary flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                {listing?.location?.city}, {listing?.location?.state}
                              </p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm ${
                              booking.status === 'completed'
                                ? 'bg-surface-3 text-foreground'
                                : 'bg-destructive/20 text-destructive-foreground'
                            }`}>
                              {booking.status}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
                            <div>
                              <p className="text-text-secondary">Stayed</p>
                              <p className="font-medium">
                                {new Date(booking.checkIn).toLocaleDateString()} - {new Date(booking.checkOut).toLocaleDateString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-text-secondary">Guests</p>
                              <p className="font-medium">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</p>
                            </div>
                            <div>
                              <p className="text-text-secondary">Total paid</p>
                              <p className="font-medium">{formatINR(booking.totalPrice)}</p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <Button
                              variant="outline"
                              onClick={() => navigate(`/listing/${listing?.id}`)}
                            >
                              View listing
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => navigate(`/bookings/${booking.id}/confirmation`)}
                            >
                              View confirmation
                            </Button>
                            {canReview ? (
                              <Button
                                variant="outline"
                                onClick={() => openReviewModal(booking, listing)}
                              >
                                <Star className="h-4 w-4 mr-2" />
                                Leave a review
                              </Button>
                            ) : reviewedBookings.has(booking.id) ? (
                              <Button
                                variant="outline"
                                disabled
                                className="text-text-secondary"
                              >
                                <Star className="h-4 w-4 mr-2 fill-yellow-400 text-yellow-400" />
                                Reviewed
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-text-secondary mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No past trips yet</h3>
                <p className="text-text-secondary mb-6">Your trip history will appear here</p>
                <Button onClick={() => navigate('/search')}>
                  Start exploring
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Review Modal */}
        {reviewingBooking && (
          <ReviewModal
            booking={reviewingBooking}
            listing={reviewingListing || undefined}
            onClose={() => {
              setReviewingBooking(null);
              setReviewingListing(null);
            }}
            onSubmit={handleReviewSubmit}
            submitting={submittingReview}
          />
        )}
      </div>
    </div>
  );
}

