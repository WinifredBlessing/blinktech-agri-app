import { createClient } from '@supabase/supabase-js';

// Read configuration from Vite environment variables
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL || 'https://wmmhpducvihhmcclpvtd.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  '';

// Check if a real key is present (not empty and not default placeholder)
export const isSupabaseConfigured = Boolean(
  supabaseAnonKey &&
  supabaseAnonKey !== 'YOUR_SUPABASE_PUBLISHABLE_KEY' &&
  supabaseAnonKey.trim().length > 0
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ [AgriLink] Supabase is not fully configured yet.\n' +
    'Please add your Supabase publishable/anon key to the .env file:\n' +
    'VITE_SUPABASE_ANON_KEY=your_key_here\n' +
    'Then restart the Vite development server.'
  );
}

// Instantiate the Supabase client using the safe publishable/anon key.
// A fallback placeholder string is provided if the key is not yet set,
// preventing createClient from throwing an uncaught startup exception.
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey || 'placeholder-publishable-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  }
);

/**
 * Diagnostic utility to test whether connection to your Supabase project works.
 * This can be called from browser console or test scripts.
 */
export async function testSupabaseConnection(): Promise<{
  connected: boolean;
  url: string;
  configured: boolean;
  message: string;
  error?: string;
}> {
  if (!isSupabaseConfigured) {
    return {
      connected: false,
      url: supabaseUrl,
      configured: false,
      message: 'Supabase Publishable Key is missing in .env (VITE_SUPABASE_ANON_KEY).',
    };
  }

  try {
    // Ping Supabase Auth Health endpoint to confirm live network connectivity
    const response = await fetch(`${supabaseUrl}/auth/v1/health`, {
      headers: {
        apikey: supabaseAnonKey,
      },
    });

    if (!response.ok) {
      const errText = await response.text();
      return {
        connected: false,
        url: supabaseUrl,
        configured: true,
        message: `Supabase server responded with status ${response.status}: ${errText}`,
        error: errText,
      };
    }

    const { error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      return {
        connected: false,
        url: supabaseUrl,
        configured: true,
        message: `Supabase Auth error: ${sessionError.message}`,
        error: sessionError.message,
      };
    }

    return {
      connected: true,
      url: supabaseUrl,
      configured: true,
      message: 'Successfully connected to Supabase service!',
    };
  } catch (err: any) {
    return {
      connected: false,
      url: supabaseUrl,
      configured: true,
      message: `Failed to connect to Supabase: ${err.message || err}`,
      error: err.message,
    };
  }
}

// Expose diagnostic utilities on window only in development mode for console testing.
// Never expose the Supabase client or diagnostics on the window object in production.
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).testSupabaseConnection = testSupabaseConnection;
  (window as any).supabase = supabase;
}
