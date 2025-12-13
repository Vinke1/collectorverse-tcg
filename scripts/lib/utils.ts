/**
 * Shared utility functions for scripts
 */

/**
 * Waits for a specified amount of time
 * @param ms - Time to wait in milliseconds
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Converts a slug to a title (kebab-case to Title Case)
 * @param slug - The slug to convert (e.g., "hello-world")
 * @returns The title (e.g., "Hello World")
 */
export function slugToTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Validates that Supabase environment variables are properly configured
 * @throws Will exit process with code 1 if validation fails
 */
export function validateSupabaseEnv(): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || supabaseServiceKey === 'placeholder-service-role-key') {
    console.error('❌ ERREUR: Veuillez configurer vos vraies clés Supabase dans .env.local')
    console.error('📝 Obtenez vos clés ici: https://supabase.com/dashboard/project/_/settings/api')
    process.exit(1)
  }
}
