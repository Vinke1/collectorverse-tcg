import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";

// Singleton instance of the Supabase client
// This ensures all parts of the app share the same session
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

export function createClient() {
  if (!supabaseInstance) {
    supabaseInstance = createBrowserClient(
      env.supabaseUrl,
      env.supabaseAnonKey
    );
  }
  return supabaseInstance;
}
