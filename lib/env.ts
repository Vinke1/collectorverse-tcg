/**
 * Environment variable access
 *
 * For client-side code (NEXT_PUBLIC_* vars), these are inlined at build time.
 * For server-side code, they're read from process.env at runtime.
 */

/**
 * Environment variables for the application
 * NEXT_PUBLIC_* variables are available on both client and server
 */
export const env = {
  // Supabase (required) - NEXT_PUBLIC vars are inlined at build time
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,

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
