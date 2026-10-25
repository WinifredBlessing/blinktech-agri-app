/**
 * payoutService.ts
 *
 * Frontend service for managing farmer payout account data.
 * Communicates with:
 *   - public.farmer_payout_accounts (Supabase table, via RLS)
 *   - verify-farmer-bank-account (Supabase Edge Function, for Paystack calls)
 *
 * SECURITY & ARCHITECTURE:
 *   - Uses the existing Supabase client (`supabase.functions.invoke()`).
 *   - Automatically attaches the authenticated user's session JWT.
 *   - The Paystack Secret Key is NEVER present in frontend code or requests.
 *   - Raw account numbers are NEVER stored or returned from the server.
 *   - All Paystack API calls go through the Edge Function.
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PayoutVerificationStatus = 'not_verified' | 'verifying' | 'verified' | 'failed';

export interface FarmerPayoutAccount {
  id: string;
  farmerId: string;
  bankCode: string;
  bankName: string;
  accountName: string;
  /** Masked display number, e.g. ****6789 */
  maskedAccountNumber: string;
  verificationStatus: PayoutVerificationStatus;
  /** Reserved for future Paystack subaccount integration. */
  paystackSubaccountCode: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaystackBank {
  code: string;
  name: string;
}

export interface VerifyAccountResult {
  success: boolean;
  accountName?: string;
  maskedAccountNumber?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a raw DB row to a typed FarmerPayoutAccount. */
function mapRowToAccount(row: any): FarmerPayoutAccount {
  return {
    id: row.id,
    farmerId: row.farmer_id,
    bankCode: row.bank_code,
    bankName: row.bank_name,
    accountName: row.account_name,
    maskedAccountNumber: row.masked_account_number,
    verificationStatus: row.verification_status as PayoutVerificationStatus,
    paystackSubaccountCode: row.paystack_subaccount_code ?? null,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Safely parse error messages returned from supabase.functions.invoke or network failures.
 */
async function parseFunctionError(error: any): Promise<string> {
  if (!error) return 'An unexpected error occurred. Please try again.';

  // If error has a response context with JSON body (standard in @supabase/functions-js)
  if (error.context) {
    try {
      if (typeof error.context.json === 'function') {
        const errorJson = await error.context.json();
        if (errorJson && typeof errorJson === 'object' && errorJson.error) {
          return String(errorJson.error);
        }
      } else if (typeof error.context === 'object' && error.context.error) {
        return String(error.context.error);
      }
    } catch {
      try {
        if (typeof error.context.text === 'function') {
          const text = await error.context.text();
          if (text) return text;
        }
      } catch {
        // Fall through to error.message
      }
    }
  }

  const msg = (error.message || '').toString();
  if (
    msg.toLowerCase().includes('failed to send a request') ||
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('networkerror')
  ) {
    return 'Network connection error. Unable to reach verification service. Please check your internet connection.';
  }
  if (msg.toLowerCase().includes('relay error')) {
    return 'Unable to reach the Supabase Edge Function relay. Please try again shortly.';
  }

  return error.message || 'An unexpected error occurred. Please try again.';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch the list of Nigerian banks from the secure Edge Function.
 * Uses `supabase.functions.invoke('verify-farmer-bank-account', { body: { action: 'get-bank-list' } })`.
 * The caller's session JWT is passed automatically by the Supabase client.
 */
export async function fetchBankList(): Promise<PaystackBank[]> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  // 1. Ensure user is authenticated before calling
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error('You must be signed in to load Nigerian banks.');
  }

  // 2. Invoke the deployed Edge Function
  const { data, error } = await supabase.functions.invoke('verify-farmer-bank-account', {
    body: {
      action: 'get-bank-list',
    },
  });

  // 3. Handle errors returned by the Edge Function or relay
  if (error) {
    const errorMsg = await parseFunctionError(error);
    throw new Error(errorMsg);
  }

  if (!data) {
    throw new Error('Empty response received from verification service.');
  }

  if (!data.success) {
    throw new Error(data.error || 'Failed to fetch Nigerian bank list.');
  }

  if (!Array.isArray(data.banks)) {
    throw new Error('Unexpected response format: bank list was not returned.');
  }

  // 4. Return sanitized bank objects (code and name)
  return data.banks
    .map((b: any) => ({
      code: String(b.code || '').trim(),
      name: String(b.name || '').trim(),
    }))
    .filter((b: PaystackBank) => b.code && b.name);
}

/**
 * Verify a bank account number via the secure Edge Function.
 * Uses `supabase.functions.invoke('verify-farmer-bank-account', { body: { action: 'verify-account', bank_code, account_number } })`.
 *
 * The raw account_number is sent over HTTPS to the Edge Function, which calls Paystack Resolve.
 * The raw account number is NEVER stored or echoed back in full.
 *
 * @param bankCode   Paystack bank code (e.g. "058")
 * @param accountNumber   10-digit NUBAN account number
 */
export async function verifyBankAccount(
  bankCode: string,
  accountNumber: string
): Promise<VerifyAccountResult> {
  if (!isSupabaseConfigured) {
    return { success: false, error: 'Supabase is not configured.' };
  }

  // 1. Session check
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return { success: false, error: 'You must be signed in to verify a bank account.' };
  }

  // 2. Client-side input validation for user convenience
  const cleanBankCode = bankCode ? bankCode.trim() : '';
  if (!cleanBankCode) {
    return { success: false, error: 'Please select a bank.' };
  }

  const cleanAccountNumber = accountNumber ? accountNumber.trim().replace(/\s/g, '') : '';
  if (!cleanAccountNumber || !/^\d{10}$/.test(cleanAccountNumber)) {
    return { success: false, error: 'Account number must be exactly 10 digits.' };
  }

  try {
    // 3. Invoke Edge Function with authenticated session
    const { data, error } = await supabase.functions.invoke('verify-farmer-bank-account', {
      body: {
        action: 'verify-account',
        bank_code: cleanBankCode,
        account_number: cleanAccountNumber,
      },
    });

    if (error) {
      const errorMsg = await parseFunctionError(error);
      return { success: false, error: errorMsg };
    }

    if (!data) {
      return { success: false, error: 'Empty response received from verification service.' };
    }

    if (!data.success) {
      return {
        success: false,
        error:
          data.error ||
          "We couldn't verify this bank account. Please check your bank and account number and try again.",
      };
    }

    if (!data.account_name) {
      return {
        success: false,
        error: "Verified account name was not returned. Please try again.",
      };
    }

    return {
      success: true,
      accountName: data.account_name,
      maskedAccountNumber: data.masked_account_number || `****${cleanAccountNumber.slice(-4)}`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error. Please check your connection and try again.',
    };
  }
}

/**
 * Fetch the current farmer's active payout account from the database.
 * Returns null if no account has been added yet or table is not created.
 */
export async function fetchMyPayoutAccount(): Promise<FarmerPayoutAccount | null> {
  if (!isSupabaseConfigured) return null;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('farmer_payout_accounts')
      .select('*')
      .eq('farmer_id', user.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      // Table doesn't exist yet or RLS restriction
      console.warn('[payoutService] fetchMyPayoutAccount notice:', error.message);
      return null;
    }

    return data ? mapRowToAccount(data) : null;
  } catch (err) {
    console.warn('[payoutService] fetchMyPayoutAccount unexpected notice:', err);
    return null;
  }
}

/**
 * Save (upsert) a verified payout account for the current farmer.
 * Uses ON CONFLICT (farmer_id) DO UPDATE so editing replaces the old record
 * in-place rather than creating orphan rows.
 *
 * Only safe, non-sensitive fields are stored:
 *   - bank_code, bank_name, account_name, masked_account_number
 *   - verification_status = 'verified'
 *
 * The raw account number is NEVER passed to or stored by this function.
 */
export async function savePayoutAccount(params: {
  bankCode: string;
  bankName: string;
  accountName: string;
  maskedAccountNumber: string;
}): Promise<FarmerPayoutAccount> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to save a payout account.');
  }

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from('farmer_payout_accounts')
    .upsert(
      {
        farmer_id: user.id,
        bank_code: params.bankCode,
        bank_name: params.bankName,
        account_name: params.accountName,
        masked_account_number: params.maskedAccountNumber,
        verification_status: 'verified',
        is_active: true,
        updated_at: now,
      },
      {
        onConflict: 'farmer_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('[payoutService] savePayoutAccount error:', error.message);
    if (error.code === 'PGRST205') {
      throw new Error(
        'Database table "farmer_payout_accounts" has not been created yet in Supabase. Please run the supabase_payout_accounts_schema.sql migration in your Supabase SQL Editor.'
      );
    }
    throw new Error(error.message || 'Failed to save payout account. Please try again.');
  }

  return mapRowToAccount(data);
}
