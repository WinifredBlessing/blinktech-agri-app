// Supabase Edge Function: verify-farmer-bank-account
// Purpose: Securely verify a Nigerian bank account number using the Paystack
//          Resolve Account API. The Paystack Secret Key is read from Supabase
//          Secrets (environment variables) and is NEVER exposed to the browser.
//
// Deployment:
//   supabase functions deploy verify-farmer-bank-account --no-verify-jwt
//
// Required Supabase Secret (set once in Supabase Dashboard → Project Settings → Edge Functions → Secrets):
//   PAYSTACK_SECRET_KEY
//
// This function also serves the Paystack bank list endpoint to avoid exposing
// the secret key on the client side.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// CORS — allow requests only from the known AgriLink origin in production.
// In development (localhost) all origins are permitted.
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 1. Read the Paystack Secret Key from Supabase Secrets (server-side only)
    const paystackSecret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecret) {
      console.error('[verify-farmer-bank-account] PAYSTACK_SECRET_KEY secret is not configured.');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Payment verification service is not configured. Please contact support.',
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Authenticate the calling user via the Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a Supabase client using the caller's JWT to enforce RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // 3. Verify the caller is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authentication required.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Verify caller has farmer role in profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    // Treat a database/RLS error as a service fault — NOT as "access denied"
    if (profileError) {
      console.error('[verify-farmer-bank-account] Profile lookup error:', profileError.message, '| user:', user.id);
      return new Response(
        JSON.stringify({ success: false, error: 'Unable to verify your account. Please try again.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const normalizedRole = profile?.role?.toString().toLowerCase();
    if (!profile || (normalizedRole !== 'farmer' && normalizedRole !== 'admin')) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied. Only registered farmers and authorized admins may use this service.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Parse the action from the request body
    const body = await req.json();
    const { action } = body;

    // ---------------------------------------------------------------------------
    // ACTION: get-bank-list
    // Returns a list of Nigerian banks from Paystack for the bank selector.
    // ---------------------------------------------------------------------------
    if (action === 'get-bank-list') {
      const paystackResp = await fetch('https://api.paystack.co/bank?country=nigeria&perPage=200', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          'Content-Type': 'application/json',
        },
      });

      if (!paystackResp.ok) {
        console.error('[verify-farmer-bank-account] Paystack bank list fetch failed:', paystackResp.status);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch bank list. Please try again.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackData = await paystackResp.json();
      if (!paystackData.status) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to fetch bank list from Paystack.' }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Return only the fields the client needs (code, name)
      const banks = (paystackData.data || []).map((b: any) => ({
        code: b.code,
        name: b.name,
      }));

      return new Response(
        JSON.stringify({ success: true, banks }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ---------------------------------------------------------------------------
    // ACTION: verify-account
    // Calls Paystack's Resolve Account API to verify a bank account number.
    // ---------------------------------------------------------------------------
    if (action === 'verify-account') {
      const { bank_code, account_number } = body;

      // Validate inputs server-side
      if (!bank_code || typeof bank_code !== 'string' || bank_code.trim().length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: 'A valid bank must be selected.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!account_number || typeof account_number !== 'string') {
        return new Response(
          JSON.stringify({ success: false, error: 'Account number is required.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Strict format validation: exactly 10 digits (NUBAN standard)
      const cleanAccountNumber = account_number.trim().replace(/\s/g, '');
      if (!/^\d{10}$/.test(cleanAccountNumber)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Account number must be exactly 10 digits.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Call Paystack Resolve Account API (server-side only)
      const resolveUrl = `https://api.paystack.co/bank/resolve?account_number=${cleanAccountNumber}&bank_code=${encodeURIComponent(bank_code.trim())}`;

      let paystackResp: Response;
      try {
        paystackResp = await fetch(resolveUrl, {
          method: 'GET',
          headers: {
            // Secret key used ONLY here on the server — never sent to the browser
            Authorization: `Bearer ${paystackSecret}`,
            'Content-Type': 'application/json',
          },
        });
      } catch (fetchErr) {
        console.error('[verify-farmer-bank-account] Network error calling Paystack:', fetchErr);
        return new Response(
          JSON.stringify({
            success: false,
            error: 'We couldn\'t connect to the verification service. Please try again.',
          }),
          { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const paystackData = await paystackResp.json();

      if (!paystackResp.ok || !paystackData.status) {
        // Log the actual error server-side for debugging, but never expose it to the browser
        console.warn('[verify-farmer-bank-account] Paystack resolve failed:', {
          status: paystackResp.status,
          message: paystackData?.message,
        });

        return new Response(
          JSON.stringify({
            success: false,
            error: 'We couldn\'t verify this bank account. Please check your bank and account number and try again.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verification successful — return only the account name
      // The raw account number is NEVER echoed back in the response body.
      const accountName: string = paystackData.data?.account_name || '';

      if (!accountName) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'We couldn\'t verify this bank account. Please check your bank and account number and try again.',
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          account_name: accountName,
          // The masked number is computed server-side from the raw number
          // so the raw number is never stored or returned.
          masked_account_number: `****${cleanAccountNumber.slice(-4)}`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Unknown action
    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('[verify-farmer-bank-account] Unhandled error:', err?.message || err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
