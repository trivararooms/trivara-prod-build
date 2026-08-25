// Send booking confirmation email to guest and host using SMTP
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

    // ... (Formatting logic remains similar to previous implementation)
    // Format dates
    const checkInDate = new Date(booking.start_date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const checkOutDate = new Date(booking.end_date).toLocaleDateString('en-IN', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    const nights = Math.ceil((new Date(booking.end_date).getTime() - new Date(booking.start_date).getTime()) / (1000 * 60 * 60 * 24));
    const totalPriceFormatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(booking.total_price);

    // Email HTML Templates
    const guestEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Booking Confirmation - Trivara Stays</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <div style="padding: 32px; text-align: center; background-color: #4f46e5; color: white;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Booking Confirmed!</h1>
            </div>
            <div style="padding: 32px;">
              <p style="font-size: 16px; margin-bottom: 24px;">Hi ${guest.first_name},</p>
              <p style="font-size: 16px; margin-bottom: 24px;">Your booking for <strong>${booking.listing?.title}</strong> has been confirmed.</p>
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;">
                <h2 style="margin-top: 0; color: #1f2937;">Trip Details</h2>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px;">
                  <div><p style="margin: 4px 0; color: #6b7280; font-size: 14px;">Check-in</p><p style="margin: 4px 0; font-weight: 500;">${checkInDate}</p></div>
                  <div><p style="margin: 4px 0; color: #6b7280; font-size: 14px;">Check-out</p><p style="margin: 4px 0; font-weight: 500;">${checkOutDate}</p></div>
                </div>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
                  <div><p style="margin: 4px 0; color: #6b7280; font-size: 14px;">Guests</p><p style="margin: 4px 0; font-weight: 500;">${booking.guests} guests</p></div>
                  <div><p style="margin: 4px 0; color: #6b7280; font-size: 14px;">Nights</p><p style="margin: 4px 0; font-weight: 500;">${nights} nights</p></div>
                </div>
                <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
                  <p style="margin: 4px 0; color: #6b7280; font-size: 14px;">Total Price Paid</p>
                  <p style="margin: 4px 0; font-size: 20px; font-weight: 600; color: #4f46e5;">${totalPriceFormatted}</p>
                </div>
              </div>
              <p style="font-size: 16px; margin-bottom: 0;">Thank you for choosing Trivara Stays!<br>The Trivara Team</p>
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
          <title>New Booking - Trivara Stays</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: white;">
            <div style="padding: 32px; text-align: center; background-color: #10b981; color: white;">
              <h1 style="margin: 0; font-size: 24px;">New Booking Received!</h1>
            </div>
            <div style="padding: 32px;">
              <p>Hi ${host.first_name},</p>
              <p>You have a new booking for <strong>${booking.listing?.title}</strong>.</p>
              <div style="background-color: #f9fafb; padding: 24px; border-radius: 8px; margin: 24px 0;">
                <p><strong>Guest:</strong> ${guest.first_name} ${guest.last_name}</p>
                <p><strong>Check-in:</strong> ${checkInDate}</p>
                <p><strong>Check-out:</strong> ${checkOutDate}</p>
                <p><strong>Total Earnings:</strong> ${totalPriceFormatted}</p>
              </div>
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

      // Send Guest Email
      await client.send({
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: guest.email,
        subject: `Booking Confirmed: ${booking.listing?.title}`,
        content: guestEmailHtml,
        html: guestEmailHtml,
      });

      // Send Host Email
      await client.send({
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: host.email,
        subject: `New Booking: ${booking.listing?.title}`,
        content: hostEmailHtml,
        html: hostEmailHtml,
      });

      await client.close();

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (smtpError: unknown) {
      console.error('SMTP sending failed:', smtpError);
      // Fails cleanly as per requirements
      return new Response(JSON.stringify({ success: false, error: errMsg(smtpError) }), {
        status: 200, // Still return 200 to not break the flow
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error sending confirmation emails:', error);
    return new Response(JSON.stringify({ error: errMsg(error) }), {
      status: 200, // Return 200 to not block booking confirmation
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});