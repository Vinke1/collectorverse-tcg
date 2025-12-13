/**
 * Supabase client initialization for scripts
 */

import { config } from 'dotenv'
import { resolve } from 'path'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../lib/supabase/types'
import { validateSupabaseEnv } from './utils'

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

/**
 * Creates and returns a Supabase admin client for use in scripts
 * Automatically validates environment variables and exits if invalid
 *
 * @returns Supabase client with service role key
 */
export function createAdminClient(): SupabaseClient<Database> {
  // Validate environment variables
  validateSupabaseEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  return createSupabaseClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}
