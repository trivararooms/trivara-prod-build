// refund-razorpay-payment Edge Function
//
// Issues a real refund through the Razorpay Refunds API when a booking that
// was actually paid for gets cancelled, then updates the booking's refund
// bookkeeping (payment_status/refund_id/refund_amount/refunded_at/status) in
// one place. This closes the gap called out in supabase/migrations/README.md:
// `process_booking_refund()` existed but was admin-only and never actually
// called the Razorpay API - it only recorded bookkeeping someone had already
// entered by hand. This function is the real thing, callable by the guest
// who owns the booking (or an admin), and it talks to Razorpay directly.
//
// Deploy with: supabase functions deploy refund-razorpay-payment
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { booking_id } = await req.json();
    if (!booking_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing booking_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client for all reads/writes - RLS is intentionally
    // bypassed here because the ownership/admin check below is done
    // explicitly in code instead.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // A second client scoped to the caller's own JWT, used only to find out
    // who is actually calling this (never used for data access).
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerId = userData.user.id;

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .select('id, guest_id, total_price, payment_status, razorpay_payment_id')
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ success: false, error: 'Booking not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Only the guest who made the booking, or an admin, may trigger its refund.
    let isAuthorized = booking.guest_id === callerId;
    if (!isAuthorized) {
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', callerId)
        .single();
      isAuthorized = callerProfile?.role === 'admin';
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ success: false, error: 'You are not authorized to cancel/refund this booking' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Nothing was actually captured via Razorpay - no refund to process.
    // The caller (bookingService.cancelBooking) still needs to flip the
    // booking to 'cancelled' itself in this case.
    if (booking.payment_status !== 'paid' || !booking.razorpay_payment_id) {
      return new Response(JSON.stringify({ success: true, refunded: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: settings, error: settingsError } = await supabaseAdmin
      .from('app_settings')
      .select('key, value')
      .filter('category', 'eq', 'razorpay');

    if (settingsError) throw settingsError;

    const getSetting = (key: string) => settings?.find(s => s.key === key)?.value;
    const razorpayKeyId = getSetting('razorpay_key_id');
    const razorpayKeySecret = getSetting('razorpay_key_secret');

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(JSON.stringify({ success: false, error: 'Razorpay credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Full refund - amount is in paise (INR * 100), matching how the order
    // was originally created in create-razorpay-order.
    const amountInPaise = booking.total_price * 100;
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);

    const refundResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${booking.razorpay_payment_id}/refund`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          notes: { booking_id },
        }),
      }
    );

    const refund = await refundResponse.json();

    if (!refundResponse.ok) {
      console.error('Razorpay refund API error:', refund);
      throw new Error(refund.error?.description || 'Razorpay refused the refund request');
    }

    const { error: updateError } = await supabaseAdmin
      .from('bookings')
      .update({
        payment_status: 'refunded',
        refund_id: refund.id,
        refund_amount: refund.amount,
        refunded_at: new Date().toISOString(),
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      })
      .eq('id', booking_id);

    if (updateError) throw updateError;

    // Any host_earnings row generated for this booking (e.g. a booking that
    // was somehow both completed and then refunded by an admin) should not
    // be paid out.
    await supabaseAdmin
      .from('host_earnings')
      .update({ status: 'failed' })
      .eq('booking_id', booking_id)
      .eq('status', 'pending');

    return new Response(JSON.stringify({
      success: true,
      refunded: true,
      refund: { id: refund.id, amount: refund.amount, currency: refund.currency },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Error processing refund:', error);
    return new Response(JSON.stringify({ success: false, error: errMsg(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
