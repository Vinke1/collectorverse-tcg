/**
 * Environment variable access
 *
 * For client-side code (NEXT_PUBLIC_* vars), these are inlined at build time.
 * For server-side code, they're read from process.env at runtime.
 */

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing!');
  console.error('Available env vars:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
}

if (!supabaseAnonKey) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is missing!');
}

/**
 * Environment variables for the application
 * NEXT_PUBLIC_* variables are available on both client and server
 */
export const env = {
  // Supabase (required) - NEXT_PUBLIC vars are inlined at build time
  supabaseUrl: supabaseUrl || '',
  supabaseAnonKey: supabaseAnonKey || '',

  // Site URL (optional with default)
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000',
} as const;

/**
 * Server-only environment variables
 * These should only be accessed in server components or API routes
 */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!value) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY - this should only be used server-side');
    }
    return value;
  },
} as const;
