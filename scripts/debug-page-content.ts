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
    await new Promise(r => setTimeout(r, 2000))

    // Navigate to page 6
    for (let p = 2; p <= 6; p++) {
      const clicked = await page.evaluate((targetPage) => {
        const pageLinks = document.querySelectorAll('.pagination .page-item .page-link')
        for (const link of pageLinks) {
          const pageNum = link.getAttribute('data-page')
          const text = link.textContent?.trim()
          if (pageNum === targetPage.toString() || text === targetPage.toString()) {
            (link as HTMLElement).click()
            return true
          }
        }
        return false
      }, p)

      if (clicked) {
        await new Promise(r => setTimeout(r, 2000))
        console.log(`Navigated to page ${p}`)
      }
    }

    // Get card numbers on page 6
    const cardInfo = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/cards/"]')
      const results: string[] = []

      links.forEach(link => {
        const href = (link as HTMLAnchorElement).href
        if (href.includes('/cards/') && !href.includes('cartes-les-plus-cheres')) {
          const match = href.match(/\/cards\/[a-z]+-[a-z]{2}-(\d{3})-\d+-[a-z]-/)
          if (match) {
            results.push(match[1])
          }
        }
      })

      return results
    })

    console.log('\nCard numbers on page 6:')
    console.log(cardInfo.join(', '))
    console.log(`\nTotal cards found: ${cardInfo.length}`)

    // Check if 101 is in the range
    const minNum = Math.min(...cardInfo.map(n => parseInt(n)))
    const maxNum = Math.max(...cardInfo.map(n => parseInt(n)))
    console.log(`Range: ${minNum} - ${maxNum}`)

  } finally {
    await browser.close()
  }
}

test().catch(console.error)
