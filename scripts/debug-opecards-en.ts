import puppeteer from 'puppeteer'

async function debug() {
  const browser = await puppeteer.launch({ headless: false })
  const page = await browser.newPage()

  await page.goto('https://www.opecards.fr/cards/search?sortBy=number&serie=187&language=EN&page=1', {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  await new Promise(resolve => setTimeout(resolve, 3000))

  // Extraire tous les liens
  const allLinks = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
    return links.map(a => ({
      href: (a as HTMLAnchorElement).href,
      text: a.textContent?.trim()
    }))
  })

  console.log('Tous les liens /cards/:')
  console.log(JSON.stringify(allLinks, null, 2))

  // Extraire les URLs de cartes avec le pattern actuel
  const cardUrls = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a[href*="/cards/"]'))
      .map(a => (a as HTMLAnchorElement).href)
      .filter(href => {
        const path = new URL(href).pathname
        if (path === '/cards' || path === '/cards/' || path.includes('/search')) {
          return false
        }
        return /^\/cards\/(p-\d{3}-p-|[a-z]+\d+-\d{3}-[a-z]+-)/i.test(path)
      })
    return [...new Set(links)]
  })

  console.log('\nURLs de cartes filtrées:')
  console.log(JSON.stringify(cardUrls, null, 2))

  await new Promise(resolve => setTimeout(resolve, 60000))
  await browser.close()
}

debug()
