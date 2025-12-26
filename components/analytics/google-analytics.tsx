'use client'

import Script from 'next/script'

/**
 * Google Analytics 4 component
 *
 * To use:
 * 1. Create a GA4 property at https://analytics.google.com
 * 2. Copy your Measurement ID (G-XXXXXXXXXX)
 * 3. Add to .env.local: NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
 *
 * The component will only load in production and when the ID is configured.
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  // Only load in production with a valid measurement ID
  if (!measurementId || process.env.NODE_ENV !== 'production') {
    return null
  }

  return (
    <>
      {/* Global Site Tag (gtag.js) - Google Analytics */}
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${measurementId}', {
            page_path: window.location.pathname,
          });
        `}
      </Script>
    </>
  )
}

/**
 * Track custom events in Google Analytics
 * @param action - Event action (e.g., 'click', 'view', 'add_to_collection')
 * @param category - Event category (e.g., 'Card', 'Series', 'Navigation')
 * @param label - Event label (optional, e.g., card name)
 * @param value - Event value (optional, numeric)
 */
export function trackEvent(
  action: string,
  category: string,
  label?: string,
  value?: number
) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    const gtag = window.gtag as (
      command: string,
      action: string,
      params: Record<string, unknown>
    ) => void

    gtag('event', action, {
      event_category: category,
      event_label: label,
      value: value,
    })
  }
}

/**
 * Track page views (useful for SPA navigation)
 * @param url - Page URL
 * @param title - Page title
 */
export function trackPageView(url: string, title?: string) {
  if (typeof window !== 'undefined' && 'gtag' in window) {
    const gtag = window.gtag as (
      command: string,
      measurementId: string,
      params: Record<string, unknown>
    ) => void

    const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
    if (measurementId) {
      gtag('config', measurementId, {
        page_path: url,
        page_title: title,
      })
    }
  }
}
