// Example integration code for calling email notification functions
// These should be added to the respective service files

import { supabase } from '@/lib/supabase';

// Add to bookingService.ts after successful booking creation
async function sendBookingConfirmation(bookingId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('sendBookingConfirmationEmail', {
      body: { booking_id: bookingId }
    });
    
    if (error) {
      console.error('Failed to send booking confirmation email:', error);
    } else {
      console.log('Booking confirmation emails sent successfully:', data);
    }
  } catch (error) {
    console.error('Error invoking booking confirmation function:', error);
  }
}

// Add to bookingService.ts after successful booking cancellation
async function sendBookingCancellation(bookingId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('sendBookingCancellationEmail', {
      body: { booking_id: bookingId }
    });
    
    if (error) {
      console.error('Failed to send booking cancellation email:', error);
    } else {
      console.log('Booking cancellation emails sent successfully:', data);
    }
  } catch (error) {
    console.error('Error invoking booking cancellation function:', error);
  }
}

// Add to payoutService.ts after successful payout request creation
async function sendPayoutRequestNotification(payoutId: string) {
  try {
    const { data, error } = await supabase.functions.invoke('sendPayoutRequestEmail', {
      body: { payout_id: payoutId }
    });
    
    if (error) {
      console.error('Failed to send payout request email:', error);
    } else {
      console.log('Payout request email sent successfully:', data);
    }
  } catch (error) {
    console.error('Error invoking payout request function:', error);
  }
}

// Example usage in bookingService.create():
/*
async create(...) {
  // ... existing booking creation logic ...
  
  // After successful booking creation
  if (bookingData) {
    await sendBookingConfirmation(bookingData.id);
  }
  
  return booking;
}
*/

// Example usage in bookingService.cancelBooking():
/*
async cancelBooking(bookingId: string) {
  // ... existing cancellation logic ...
  
  // After successful cancellation
  if (result.success) {
    await sendBookingCancellation(bookingId);
  }
  
  return result;
}
*/

// Example usage in payoutService.requestPayout():
/*
async requestPayout(hostId: string, amount: number) {
  // ... existing payout request logic ...
  
  // After successful payout request creation
  if (payoutData) {
    await sendPayoutRequestNotification(payoutData.id);
  }
}
*/

export {
  sendBookingConfirmation,
  sendBookingCancellation,
  sendPayoutRequestNotification
};