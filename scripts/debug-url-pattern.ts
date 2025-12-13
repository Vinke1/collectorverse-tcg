import puppeteer from 'puppeteer'

async function test() {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  try {
    console.log('Navigating to series page...')
    await page.goto('https://www.swucards.fr/series/shd-ombres-de-la-galaxie', {
      waitUntil: 'networkidle0',
      timeout: 30000
    })
    await new Promise(r => setTimeout(r, 3000))

    // Get all card URLs
    const urls = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      return Array.from(links)
        .map(l => (l as HTMLAnchorElement).href)
        .filter(u => u.includes('/cards/') && !u.includes('cartes-les-plus-cheres'))
        .slice(0, 10)
    })

    console.log('Card URLs found on page 1:')
    urls.forEach(u => console.log('  ' + u))

    // Test different regex patterns
    if (urls.length > 0) {
      const url = urls[0]
      console.log('\nTesting URL:', url)

      // Pattern 1: with hyphen between series and lang
      const match1 = url.match(/\/cards\/([a-z]+)-([a-z]{2})-(\d+)-(\d+)-([a-z])-(.+)/)
      console.log('Pattern 1 (series-lang):', match1)

      // Pattern 2: without hyphen
      const match2 = url.match(/\/cards\/([a-z]+)(fr|en)-(\d+)-(\d+)-([a-z])-(.+)/)
      console.log('Pattern 2 (serieslang):', match2)

      // Pattern 3: just extract number
      const match3 = url.match(/-(\d{3})-\d+-[a-z]-/)
      console.log('Pattern 3 (just number):', match3)
    }

  } finally {
    await browser.close()
  }
}

test().catch(console.error)
