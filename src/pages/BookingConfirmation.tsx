import { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { Loader2, MapPin, Printer, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { bookingService } from '@/services/bookingService';
import { listingService } from '@/services/listingService';
import { profileService } from '@/services/profileService';
import { Booking, Listing } from '@/types';
import { formatINR } from '@/lib/utils';

/**
 * A real itinerary/confirmation page with a reference number and a printable
 * receipt - previously, paying for a booking just dropped you on /trips with
 * a toast and nothing else to save or reference.
 */
export default function BookingConfirmation() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [booking, setBooking] = useState<Booking | null | undefined>(undefined);
  const [listing, setListing] = useState<Listing | null>(null);
  const [host, setHost] = useState<{ first_name: string; last_name: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    bookingService.getById(id).then(async (b) => {
      if (cancelled) return;
      setBooking(b ?? null);
      if (b) {
        const [listingData, hostProfile] = await Promise.all([
          listingService.getById(b.listingId),
          profileService.getByUserId(b.hostId),
        ]);
        if (!cancelled) {
          setListing(listingData ?? null);
          setHost(hostProfile);
        }
      }
    }).catch((error) => {
      console.error('Error loading booking:', error);
      if (!cancelled) setBooking(null);
    });

    return () => { cancelled = true; };
  }, [id]);

  if (authLoading || booking === undefined) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!booking || (booking.guestId !== user.id && booking.hostId !== user.id)) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-medium mb-4">Booking not found</h1>
          <Button onClick={() => navigate('/trips')}>Back to trips</Button>
        </div>
      </div>
    );
  }

  const nights = Math.max(
    1,
    Math.round((booking.checkOut.getTime() - booking.checkIn.getTime()) / (24 * 60 * 60 * 1000))
  );
  const isConfirmed = booking.status === 'confirmed' || booking.status === 'completed';

  return (
    <div className="min-h-screen bg-background print:bg-white">
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border: 1px solid #ccc !important; }
        }
      `}</style>

      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <h1 className="text-3xl font-display font-medium text-foreground">Booking confirmation</h1>
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="h-4 w-4" />
            Print / Save receipt
          </Button>
        </div>

        <Card className="print-card shadow-none border-border">
          <CardContent className="p-8">
            <div className="flex items-center gap-2 mb-8">
              {isConfirmed ? (
                <CheckCircle2 className="h-6 w-6 text-accent" />
              ) : (
                <Loader2 className="h-6 w-6 text-text-secondary" />
              )}
              <div>
                <p className="font-medium text-lg capitalize">{booking.status.replace('_', ' ')}</p>
                <p className="text-sm text-text-meta">Reference #{booking.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>

            {listing && (
              <div className="flex gap-4 pb-8 border-b border-border">
                {listing.photos?.[0] && (
                  <img src={listing.photos[0]} alt={listing.title} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />
                )}
                <div>
                  <h2 className="font-medium">{listing.title}</h2>
                  <p className="text-sm text-text-secondary flex items-center gap-1 mt-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {listing.location?.city}, {listing.location?.state}, {listing.location?.country}
                  </p>
                  {host && (
                    <p className="text-sm text-text-secondary mt-1">Hosted by {host.first_name} {host.last_name}</p>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm py-8 border-b border-border">
              <div>
                <p className="text-text-secondary">Check-in</p>
                <p className="font-medium">{booking.checkIn.toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
              </div>
              <div>
                <p className="text-text-secondary">Check-out</p>
                <p className="font-medium">{booking.checkOut.toLocaleDateString(undefined, { dateStyle: 'medium' })}</p>
              </div>
              <div>
                <p className="text-text-secondary">Guests</p>
                <p className="font-medium">{booking.guests} {booking.guests === 1 ? 'guest' : 'guests'}</p>
              </div>
              <div>
                <p className="text-text-secondary">Nights</p>
                <p className="font-medium">{nights}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-8 mb-2">
              <span className="text-text-secondary">Total paid</span>
              <span className="text-xl font-pillar font-bold uppercase tracking-wide text-accent">{formatINR(booking.totalPrice)}</span>
            </div>
            <p className="text-xs text-text-meta">
              Payment status: <span className="capitalize">{booking.paymentStatus}</span>
              {booking.razorpayPaymentId && ` · Razorpay ID ${booking.razorpayPaymentId}`}
            </p>

            <div className="mt-8 pt-8 border-t border-border flex gap-3 no-print">
              {listing && (
                <Button variant="outline" onClick={() => navigate(`/listing/${listing.id}`)}>
                  View listing
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate('/trips')}>
                Back to trips
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
