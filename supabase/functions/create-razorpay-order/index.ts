// create-razorpay-order Edge Function
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
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { booking_id } = await req.json();

        if (!booking_id) {
            return new Response(JSON.stringify({ error: 'Missing booking_id' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Fetch Razorpay settings
        const { data: settings, error: settingsError } = await supabaseClient
            .from('app_settings')
            .select('key, value')
            .filter('category', 'eq', 'razorpay');

        if (settingsError) throw settingsError;

        // Trimmed defensively: a stray copy-pasted space or newline in either
        // value breaks Razorpay's exact-match Basic Auth check and surfaces
        // as a generic "Authentication failed" with no hint that whitespace
        // was the cause.
        const getSetting = (key: string) => settings?.find(s => s.key === key)?.value?.trim();
        const razorpayEnabled = getSetting('razorpay_enabled') === 'true';
        const razorpayKeyId = getSetting('razorpay_key_id');
        const razorpayKeySecret = getSetting('razorpay_key_secret');

        if (!razorpayEnabled) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Razorpay payments are currently disabled.'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!razorpayKeyId || !razorpayKeySecret) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Razorpay credentials not configured.'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // 2. Fetch booking details (to get the amount server-side)
        const { data: booking, error: bookingError } = await supabaseClient
            .from('bookings')
            .select('total_price, status')
            .eq('id', booking_id)
            .single();

        if (bookingError || !booking) {
            throw new Error('Booking not found');
        }

        if (booking.status !== 'pending_payment') {
            throw new Error(`Invalid booking status: ${booking.status}`);
        }

        // 3. Create Razorpay order via API
        // Razorpay amount is in paise (INR * 100)
        const amountInPaise = booking.total_price * 100;

        const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${basicAuth}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                amount: amountInPaise,
                currency: 'INR',
                receipt: `receipt_${booking_id.substring(0, 20)}`,
                notes: {
                    booking_id: booking_id
                }
            })
        });

        const order = await response.json();

        if (!response.ok) {
            console.error('Razorpay API Error:', order);
            throw new Error(order.error?.description || 'Failed to create Razorpay order');
        }

        // 4. Update booking with razorpay_order_id
        const { error: updateError } = await supabaseClient
            .from('bookings')
            .update({ razorpay_order_id: order.id })
            .eq('id', booking_id);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({
            success: true,
            order: {
                id: order.id,
                amount: order.amount,
                currency: order.currency,
                key_id: razorpayKeyId // Frontend needs the Key ID to open checkout
            }
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: unknown) {
        console.error('Error creating Razorpay order:', error);
        return new Response(JSON.stringify({ success: false, error: errMsg(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
