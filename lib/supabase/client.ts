import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

export function createClient() {
  console.log('[SupabaseClient] Creating browser client with:', {
    url: env.supabaseUrl?.substring(0, 40) + '...',
    hasKey: !!env.supabaseAnonKey,
    keyLength: env.supabaseAnonKey?.length
  });

  if (!env.supabaseUrl || !env.supabaseAnonKey) {
    console.error('[SupabaseClient] MISSING CONFIG!', { url: env.supabaseUrl, key: env.supabaseAnonKey });
  }

  return createBrowserClient(
    env.supabaseUrl,
    env.supabaseAnonKey
  );
}
