// Send booking cancellation email to guest and host using SMTP
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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

    // 1. Fetch SMTP settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('app_settings')
      .select('key, value')
      .filter('category', 'eq', 'smtp');

    if (settingsError) throw settingsError;

    const getSetting = (key: string) => settings?.find(s => s.key === key)?.value;
    const smtpEnabled = getSetting('smtp_enabled') === 'true';
    const smtpHost = getSetting('smtp_host');
    const smtpPort = parseInt(getSetting('smtp_port') || '587');
    const smtpUsername = getSetting('smtp_username');
    const smtpPassword = getSetting('smtp_password');
    const smtpFromName = getSetting('smtp_from_name') || 'Trivara Stays';
    const smtpFromEmail = getSetting('smtp_from_email') || 'noreply@trivarastays.com';

    if (!smtpEnabled) {
      console.log('SMTP is disabled. Skipping email sending.');
      return new Response(JSON.stringify({ success: true, message: 'SMTP disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch booking details
    const { data: booking, error: bookingError } = await supabaseClient
      .from('bookings')
      .select(`
        *,
        listing:listings(*)
      `)
      .eq('id', booking_id)
      .single();

    if (bookingError || !booking) {
      throw new Error('Booking not found');
    }

    // Fetch guest and host profiles
    const { data: guest } = await supabaseClient.from('profiles').select('*').eq('id', booking.guest_id).single();
    const { data: host } = await supabaseClient.from('profiles').select('*').eq('id', booking.host_id).single();

    if (!guest || !host) throw new Error('Guest or Host profile not found');

    // Respect each recipient's notification preference (defaults to true
    // when no row exists yet - see notification_preferences table).
    const { data: prefRows } = await supabaseClient
      .from('notification_preferences')
      .select('user_id, email_booking_updates')
      .in('user_id', [booking.guest_id, booking.host_id]);
    const wantsBookingEmails = (userId: string) =>
      prefRows?.find((p) => p.user_id === userId)?.email_booking_updates ?? true;

    // Format dates
    const checkInDate = new Date(booking.start_date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const checkOutDate = new Date(booking.end_date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const totalPriceFormatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(booking.total_price);

    // Email Templates
    const guestEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Cancelled - Trivara Stays</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <div style="padding: 32px; text-align: center; background-color: #ef4444; color: white;">
              <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${guest.first_name},</p>
              <p>Your booking for <strong>${booking.listing?.title}</strong> has been cancelled.</p>
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;">
                <p><strong>Original Check-in:</strong> ${checkInDate}</p>
                <p><strong>Original Check-out:</strong> ${checkOutDate}</p>
                <p><strong>Original Price:</strong> ${totalPriceFormatted}</p>
              </div>
              <p>A refund will be processed according to the cancellation policy.</p>
              <p>Best regards,<br>The Trivara Team</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const hostEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Booking Cancelled - Trivara Stays</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <div style="padding: 32px; text-align: center; background-color: #f59e0b; color: white;">
              <h1 style="margin: 0; font-size: 24px;">Booking Cancelled</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${host.first_name},</p>
              <p>A booking for <strong>${booking.listing?.title}</strong> by ${guest.first_name} has been cancelled.</p>
              <p>Best regards,<br>The Trivara Team</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // 2. Initialize SMTP Client and send emails
    const client = new SmtpClient();

    try {
      await client.connectTLS({
        hostname: smtpHost!,
        port: smtpPort,
        username: smtpUsername!,
        password: smtpPassword!,
      });

      if (wantsBookingEmails(booking.guest_id)) {
        await client.send({
          from: `"${smtpFromName}" <${smtpFromEmail}>`,
          to: guest.email,
          subject: `Booking Cancelled: ${booking.listing?.title}`,
          html: guestEmailHtml,
        });
      }

      if (wantsBookingEmails(booking.host_id)) {
        await client.send({
          from: `"${smtpFromName}" <${smtpFromEmail}>`,
          to: host.email,
          subject: `Booking Cancelled: ${booking.listing?.title}`,
          html: hostEmailHtml,
        });
      }

      await client.close();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (smtpError: unknown) {
      console.error('SMTP sending failed:', smtpError);
      return new Response(JSON.stringify({ success: false, error: errMsg(smtpError) }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error sending cancellation emails:', error);
    return new Response(JSON.stringify({ error: errMsg(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});