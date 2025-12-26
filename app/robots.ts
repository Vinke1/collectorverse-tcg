import { MetadataRoute } from 'next'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://collectorverse.io'

/**
 * Generate robots.txt for CollectorVerse
 * Allows all crawlers, disallows private routes
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',           // API routes
          '/auth/',          // Auth callbacks
          '/login',          // Login page (no SEO value)
          '/share/',         // Private share links
          '/_next/',         // Next.js internals
          '/admin/',         // Admin routes (if any)
        ],
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
  }
}
