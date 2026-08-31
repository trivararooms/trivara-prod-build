import { bookingService } from '@/services/bookingService';
import { loadRazorpayScript } from '@/lib/loadRazorpayScript';

interface PayForBookingParams {
  bookingId: string;
  listingTitle: string;
  userEmail?: string;
  userName?: string;
  onSuccess: () => void;
  onDismiss: () => void;
}

/**
 * Opens Razorpay checkout for an already-created 'pending_payment' booking.
 * Shared by ListingDetail.tsx (paying right after creating an Instant Book
 * booking) and Trips.tsx ("Pay now" - retrying an abandoned payment, or
 * paying after a host approves a Request-to-Book) so both call sites open
 * the exact same checkout instead of two copies drifting apart.
 */
export async function payForBooking({
  bookingId,
  listingTitle,
  userEmail,
  userName,
  onSuccess,
  onDismiss,
}: PayForBookingParams): Promise<{ success: boolean; error?: string }> {
  const orderResult = await bookingService.createRazorpayOrder(bookingId);
  if (!orderResult.success || !orderResult.order) {
    return { success: false, error: orderResult.error || 'Failed to initialize payment' };
  }

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded) {
    return { success: false, error: 'Could not load the payment gateway. Check your connection and try again.' };
  }

  const options = {
    key: orderResult.order.key_id,
    amount: orderResult.order.amount,
    currency: orderResult.order.currency,
    name: 'TRIVARA',
    description: `Booking for ${listingTitle}`,
    order_id: orderResult.order.id,
    handler: onSuccess,
    prefill: {
      name: userName || '',
      email: userEmail || '',
    },
    theme: {
      color: '#4f46e5',
    },
    modal: {
      ondismiss: onDismiss,
    },
  };

  const rzp = new window.Razorpay(options);
  rzp.open();
  return { success: true };
}
