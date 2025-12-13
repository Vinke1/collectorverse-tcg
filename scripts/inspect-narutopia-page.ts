import puppeteer from 'puppeteer'
import { logger } from './lib/logger'
import fs from 'fs'
import path from 'path'

async function inspectPage() {
  logger.section('Inspecting Narutopia Page')

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  try {
    const page = await browser.newPage()
    await page.setViewport({ width: 1920, height: 1080 })

    logger.info('Loading page...')
    await page.goto('https://narutopia.fr/liste-des-cartes-naruto-kayou/', {
      waitUntil: 'networkidle2',
      timeout: 60000,
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    // Get the complete HTML of SCR section
    logger.section('SCR Section HTML')
    const scrHTML = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h3'))
      const scrHeading = headings.find(h => h.textContent?.includes('SCR'))

      if (!scrHeading) return null

      // Get the entire widget container
      let container = scrHeading
      while (container && !container.classList.contains('elementor-widget-image-box')) {
        container = container.parentElement as HTMLElement
      }

      if (container) {
        return {
          html: container.outerHTML,
          className: container.className,
          id: container.id,
        }
      }

      return null
    })

    if (scrHTML) {
      logger.info('SCR container class:', scrHTML.className)
      logger.info('SCR container ID:', scrHTML.id)

      // Save HTML to file for inspection
      const htmlPath = path.join(process.cwd(), 'scripts', 'output', 'narutopia-scr-section.html')
      fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
      fs.writeFileSync(htmlPath, scrHTML.html)
      logger.success(`HTML saved to: ${htmlPath}`)

      // Show first 1000 characters
      logger.section('SCR Section HTML Preview')
      logger.info(scrHTML.html.substring(0, 1000))
    }

    // Get all clickable elements on the page
    logger.section('All Clickable Elements')
    const clickables = await page.evaluate(() => {
      const elements = document.querySelectorAll('a, button, [onclick], [role="button"]')

      return Array.from(elements)
        .filter(el => {
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          return rect.width > 0 && rect.height > 0 && style.display !== 'none'
        })
        .map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 50),
          href: (el as HTMLAnchorElement).href || '',
          class: el.className,
        }))
        .filter(el => el.text && (el.text.includes('SCR') || el.text.includes('R (')))
    })

    logger.info(`Found ${clickables.length} clickable elements mentioning rarities`)
    clickables.forEach(el => {
      logger.info(`  ${el.tag}: "${el.text}"`)
      if (el.href) {
        logger.info(`    -> ${el.href}`)
      }
    })

    // Check if images are already on the page (hidden?)
    logger.section('Images Already on Page')
    const allImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))

      return imgs
        .map(img => ({
          src: img.src,
          alt: img.alt || '',
          visible: img.offsetParent !== null,
          width: img.naturalWidth,
          height: img.naturalHeight,
          display: window.getComputedStyle(img).display,
          visibility: window.getComputedStyle(img).visibility,
        }))
        .filter(img => img.src.includes('SCR-') || img.alt.includes('SCR'))
    })

    logger.info(`Found ${allImages.length} SCR-related images`)
    allImages.forEach(img => {
      logger.info(`  ${img.src}`)
      logger.info(`    Visible: ${img.visible}, Display: ${img.display}, Visibility: ${img.visibility}`)
      logger.info(`    Dimensions: ${img.width}x${img.height}`)
    })

    // Try scrolling and see if more images load
    logger.section('Testing Lazy Loading')
    logger.info('Scrolling down...')

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })

    await new Promise(resolve => setTimeout(resolve, 3000))

    const imagesAfterScroll = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
      return imgs.filter(img => img.src.includes('SCR-')).length
    })

    logger.info(`SCR images after scroll: ${imagesAfterScroll}`)

    // Get ALL images on page to see what's available
    logger.section('All Card Images on Page')
    const cardImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))

      return imgs
        .filter(img =>
          img.src.includes('/wp-content/uploads/') &&
          img.src.match(/[A-Z]+-\d+-\d+x\d+\./)
        )
        .map(img => {
          const match = img.src.match(/\/([A-Z]+-\d+)-/)
          return {
            cardNumber: match ? match[1] : 'unknown',
            src: img.src,
            visible: img.offsetParent !== null,
          }
        })
    })

    logger.info(`Found ${cardImages.length} card images on page`)

    // Group by rarity
    const byRarity = new Map<string, number>()
    cardImages.forEach(img => {
      const rarity = img.cardNumber.split('-')[0]
      byRarity.set(rarity, (byRarity.get(rarity) || 0) + 1)
    })

    logger.info('Images by rarity:')
    byRarity.forEach((count, rarity) => {
      logger.info(`  ${rarity}: ${count} images`)
    })

    // Show SCR images specifically
    const scrImages = cardImages.filter(img => img.cardNumber.startsWith('SCR'))
    if (scrImages.length > 0) {
      logger.section('SCR Images Found on Page')
      scrImages.forEach(img => {
        logger.info(`  ${img.cardNumber}: ${img.src}`)
        logger.info(`    Visible: ${img.visible}`)
      })
    }

    logger.section('Waiting for manual inspection...')
    logger.info('Browser will stay open. Press Ctrl+C to close.')
    await new Promise(() => {})

  } catch (error) {
    logger.error('Error:', error)
  }
}

inspectPage()
