// Send payout request email to admin using SMTP
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
    const { payout_id } = await req.json();

    if (!payout_id) {
      return new Response(JSON.stringify({ error: 'Missing payout_id' }), {
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
      console.log('SMTP is disabled. Skipping payout notification email.');
      return new Response(JSON.stringify({ success: true, message: 'SMTP disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch payout request details
    const { data: payout, error: payoutError } = await supabaseClient
      .from('payout_requests')
      .select(`
        *,
        host:profiles(*)
      `)
      .eq('id', payout_id)
      .single();

    if (payoutError || !payout) throw new Error('Payout request not found');

    // Fetch admin email from settings or default
    const adminEmail = getSetting('smtp_from_email') || 'admin@trivara.com';

    // Format currency and dates
    const payoutAmountFormatted = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(payout.amount);
    const requestedDate = new Date(payout.requested_at).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    // Email content
    const adminEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><title>New Payout Request</title></head>
        <body style="font-family: sans-serif; background-color: #f5f5f5; padding: 20px;">
          <div style="max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px;">
            <h1 style="color: #8b5cf6;">New Payout Request</h1>
            <p><strong>Host:</strong> ${payout.host?.first_name} ${payout.host?.last_name}</p>
            <p><strong>Amount:</strong> ${payoutAmountFormatted}</p>
            <p><strong>Date:</strong> ${requestedDate}</p>
          </div>
        </body>
      </html>
    `;

    // 2. SMTP sending
    const client = new SmtpClient();
    try {
      await client.connectTLS({
        hostname: smtpHost!,
        port: smtpPort,
        username: smtpUsername!,
        password: smtpPassword!,
      });

      await client.send({
        from: `"${smtpFromName}" <${smtpFromEmail}>`,
        to: adminEmail,
        subject: `New Payout Request - ${payoutAmountFormatted}`,
        html: adminEmailHtml,
      });

      await client.close();
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (smtpError: unknown) {
      console.error('SMTP payout notification failed:', smtpError);
      return new Response(JSON.stringify({ success: false, error: errMsg(smtpError) }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

  } catch (error: unknown) {
    console.error('Error sending payout email:', error);
    return new Response(JSON.stringify({ error: errMsg(error) }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});