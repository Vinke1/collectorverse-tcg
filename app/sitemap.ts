import { MetadataRoute } from 'next'
import { createClient } from '@/lib/supabase/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://collectorverse.io'

/**
 * Valid TCG slugs - must match the ones in series/[tcg]/page.tsx
 */
const VALID_TCG_SLUGS = ['pokemon', 'lorcana', 'onepiece', 'riftbound', 'naruto', 'starwars', 'mtg']

/**
 * Generate dynamic sitemap for CollectorVerse
 * Includes: homepage, TCG pages, series pages, legal pages
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient()

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: new Date('2024-01-01'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/privacy`,
      lastModified: new Date('2024-01-01'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]

  // TCG pages (e.g., /series/pokemon, /series/lorcana)
  const tcgPages: MetadataRoute.Sitemap = VALID_TCG_SLUGS.map((tcg) => ({
    url: `${BASE_URL}/series/${tcg}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.9,
  }))

  // Fetch all series from database for dynamic series pages
  const { data: series } = await supabase
    .from('series')
    .select(`
      code,
      updated_at,
      tcg_games!inner(slug)
    `)
    .order('release_date', { ascending: false })

  // Series pages (e.g., /series/pokemon/swsh3, /series/lorcana/tfc)
  const seriesPages: MetadataRoute.Sitemap = (series || []).map((serie) => {
    // tcg_games is returned as an object (not array) due to !inner join
    const tcgGames = serie.tcg_games as unknown as { slug: string } | null
    const tcgSlug = tcgGames?.slug || 'unknown'
    return {
      url: `${BASE_URL}/series/${tcgSlug}/${serie.code}`,
      lastModified: serie.updated_at ? new Date(serie.updated_at) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }
  })

  return [...staticPages, ...tcgPages, ...seriesPages]
}
