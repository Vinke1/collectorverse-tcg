/**
 * Test pour extraire la vraie URL d'une carte PRB
 */

import puppeteer from 'puppeteer'

async function main() {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  // Tester une carte PRB01 EN
  const url = 'https://www.opecards.fr/cards/en-op01-006-uc-prb01-full-art-otama'
  console.log(`Test URL: ${url}`)

  await page.goto(url, { waitUntil: 'networkidle0' })
  await new Promise(resolve => setTimeout(resolve, 2000))

  const imageData = await page.evaluate(() => {
    // 1. JSON-LD
    const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
    let jsonLdImages: string[] = []
    if (jsonLdScript) {
      try {
        const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
        if (jsonLd.image) {
          jsonLdImages = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
        }
      } catch (e) {}
    }

    // 2. Toutes les images static.opecards.fr
    const allImages = Array.from(document.querySelectorAll('img[src*="static.opecards.fr"]'))
      .map(img => (img as HTMLImageElement).src)
      .filter(src => !src.includes('back-') && !src.includes('icon') && !src.includes('logo'))

    // 3. og:image
    const ogImage = document.querySelector('meta[property="og:image"]')?.getAttribute('content') || ''

    return {
      jsonLdImages,
      allImages,
      ogImage
    }
  })

  console.log('\n=== JSON-LD Images ===')
  imageData.jsonLdImages.forEach(img => console.log(img))

  console.log('\n=== All Images ===')
  imageData.allImages.forEach(img => console.log(img))

  console.log('\n=== OG Image ===')
  console.log(imageData.ogImage)

  await browser.close()
}

main().catch(console.error)
