// razorpay-webhook Edge Function
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

function errMsg(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifySignature(payload: string, signature: string, secret: string) {
    const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signatureBuffer = await crypto.subtle.sign(
        "HMAC",
        hmac,
        new TextEncoder().encode(payload)
    );
    const hashArray = Array.from(new Uint8Array(signatureBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === signature;
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const rawBody = await req.text();
        const signature = req.headers.get('x-razorpay-signature');

        if (!signature) {
            return new Response(JSON.stringify({ error: 'Missing signature' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Initialize Supabase client
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // 1. Fetch Razorpay Webhook Secret from settings
        const { data: webhookSecretSetting, error: secretError } = await supabaseClient
            .from('app_settings')
            .select('value')
            .eq('key', 'razorpay_webhook_secret')
            .single();

        // Use environment variable as fallback or if not yet in DB. Trimmed
        // defensively - see create-razorpay-order for why.
        const webhookSecret = (webhookSecretSetting?.value || Deno.env.get('RAZORPAY_WEBHOOK_SECRET'))?.trim();

        if (webhookSecret && !await verifySignature(rawBody, signature, webhookSecret)) {
            console.error('Invalid signature');
            return new Response(JSON.stringify({ error: 'Invalid signature' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const event = JSON.parse(rawBody);
        const { event: eventType, payload } = event;

        if (eventType === 'payment.captured' || eventType === 'order.paid') {
            const razorpayOrder = payload.order?.entity || payload.payment?.entity;
            const razorpayOrderId = razorpayOrder.order_id || razorpayOrder.id;
            const razorpayPaymentId = payload.payment?.entity?.id;

            // Find the booking associated with this order
            const { data: booking, error: fetchError } = await supabaseClient
                .from('bookings')
                .select('id, status, payment_status')
                .eq('razorpay_order_id', razorpayOrderId)
                .single();

            if (fetchError || !booking) {
                console.warn(`Booking not found for order ${razorpayOrderId}`);
                return new Response(JSON.stringify({ received: true }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // 2. Update booking status
            // Idempotent update: only update if not already confirmed/paid
            if (booking.status === 'pending_payment' || booking.payment_status === 'pending') {
                const { error: updateError } = await supabaseClient
                    .from('bookings')
                    .update({
                        status: 'confirmed',
                        payment_status: 'paid',
                        razorpay_payment_id: razorpayPaymentId,
                        razorpay_signature: signature
                    })
                    .eq('id', booking.id);

                if (updateError) throw updateError;

                // 3. Trigger Confirmation Email via another Edge Function
                // Fail silently here as per requirements: "No blocking booking flow due to email failure"
                try {
                    await supabaseClient.functions.invoke('sendBookingConfirmationEmail', {
                        body: { booking_id: booking.id }
                    });
                } catch (emailError) {
                    console.error(`Email delivery failed for booking ${booking.id}:`, emailError);
                }
            }
        } else if (eventType === 'payment.failed') {
            const razorpayOrderId = payload.payment?.entity?.order_id;

            const { data: booking } = await supabaseClient
                .from('bookings')
                .select('id')
                .eq('razorpay_order_id', razorpayOrderId)
                .single();

            if (booking) {
                await supabaseClient
                    .from('bookings')
                    .update({
                        payment_status: 'failed'
                    })
                    .eq('id', booking.id);
            }
        }

        return new Response(JSON.stringify({ received: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: unknown) {
        console.error('Webhook processing Error:', error);
        return new Response(JSON.stringify({ error: errMsg(error) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
