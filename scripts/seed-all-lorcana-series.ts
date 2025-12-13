/**
 * Script de scraping pour TOUTES les séries Disney Lorcana avec Puppeteer
 * Source: https://www.lorcards.fr
 *
 * Usage: npm run seed:all-lorcana
 */

import puppeteer from 'puppeteer'
import { createLorcanaBucket, uploadCardImage, uploadSeriesImage } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { parseCardUrl } from './lib/card-parser'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Définition des séries Lorcana
interface SeriesConfig {
  code: string
  name: string
  url: string
  imageUrl?: string // URL de l'image de la série
  setNumber?: number // Numéro du set principal (pour les patterns d'URL)
  maxSetBase?: number // Nombre de cartes dans le set de base
  masterSet?: number // Nombre total de cartes incluant les variantes
  skip?: boolean // Pour ignorer certaines séries
}

const ALL_SERIES: SeriesConfig[] = [
  // On skip fabuleux car déjà fait
  {
    code: 'fabuleux',
    name: 'Fabuleux',
    url: 'https://www.lorcards.fr/series/set-9-fab-fabuleux',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-9-fab-fabuleux.webp',
    setNumber: 9,
    skip: true
  },

  // Set 10
  {
    code: 'WHW',
    name: 'Lueurs dans les Profondeurs',
    url: 'https://www.lorcards.fr/series/set-10-lueurs-dans-les-profondeurs',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-10-lueurs-dans-les-profondeurs.webp',
    setNumber: 10
  },

  // Set 8
  {
    code: 'ROJ',
    name: 'Le Règne de Jafar',
    url: 'https://www.lorcards.fr/series/set-8-roj-le-regne-de-jafar',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-8-roj-le-regne-de-jafar.webp',
    setNumber: 8
  },

  // Set 7
  {
    code: 'ARI',
    name: "L'Île d'Archazia",
    url: "https://www.lorcards.fr/series/set-7-ari-l-ile-d-archazia",
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-7-ari-l-ile-d-archazia.webp',
    setNumber: 7
  },

  // Set 6
  {
    code: 'AZS',
    name: 'La Mer Azurite',
    url: 'https://www.lorcards.fr/series/set-6-azs-la-mer-azurite',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-6-azs-la-mer-azurite.webp',
    setNumber: 6
  },

  // Set 5
  {
    code: 'SSK',
    name: 'Ciel Scintillant',
    url: 'https://www.lorcards.fr/series/set-5-skk-ciel-scintillant',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-set-5-skk-ciel-scintillant.webp',
    setNumber: 5
  },

  // Set 4
  {
    code: 'URR',
    name: "Le Retour d'Ursula",
    url: 'https://www.lorcards.fr/series/urr-le-retour-d-ursula',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-urr-le-retour-d-ursula.webp',
    setNumber: 4
  },

  // Set 3
  {
    code: 'ITI',
    name: "Les Terres d'Encres",
    url: 'https://www.lorcards.fr/series/iti-les-terres-d-encres',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-iti-les-terres-d-encres.webp',
    setNumber: 3
  },

  // Set 2
  {
    code: 'ROTF',
    name: "L'Ascension Des Floodborn",
    url: 'https://www.lorcards.fr/series/rotf-ascension-des-floodborn',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-rotf-ascension-des-floodborn.webp',
    setNumber: 2
  },

  // Set 1
  {
    code: 'FirstChapter',
    name: 'Premier Chapitre',
    url: 'https://www.lorcards.fr/series/fc-premier-chapitre',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-fc-premier-chapitre.webp',
    setNumber: 1,
    maxSetBase: 204,
    masterSet: 216
  },

  // Éditions spéciales
  {
    code: 'D100',
    name: 'Disney 100',
    url: 'https://www.lorcards.fr/series/d100-edition-collector-disney-100',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-d100-edition-collector-disney-100.webp'
  },
  {
    code: 'QU1',
    name: 'Quête des Illumineurs - Menace des profondeurs',
    url: 'https://www.lorcards.fr/series/qu1-quete-des-illumineurs-menaces-des-profondeurs',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu1-quete-des-illumineurs-menaces-des-profondeurs.webp'
  },
  {
    code: 'QU2',
    name: 'Quête des Illumineurs - Vol au Palais',
    url: 'https://www.lorcards.fr/series/qu2-quete-des-illumineurs-vol-au-palais',
    imageUrl: 'https://static.lorcards.fr/series/fr/image-cartes-a-collectionner-lorcana-disney-game-tcg-lorcanacards-qu2-quete-des-illumineurs-vol-au-palais.webp'
  },

  // Promos - on peut les ajouter plus tard si besoin
  // { code: 'P', name: 'Cartes Promotionnelles', url: 'https://www.lorcards.fr/series/p-cartes-promotionnelles' },
]

// Types pour les cartes Lorcana
interface LorcanaCard {
  name: string
  number: string
  language: string
  chapter: number
  rarity: string
  imageUrl: string
  attributes: {
    slug: string
  }
}

/**
 * Récupère l'UUID du TCG Lorcana
 */
async function getLorcanaGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'lorcana')
    .single()

  if (error || !data) {
    throw new Error('TCG Lorcana non trouvé dans la base de données')
  }

  return data.id
}

/**
 * Scrape l'image de la série et les métadonnées
 */
async function scrapeSeriesMetadata(page: any, seriesUrl: string): Promise<{
  imageUrl: string | null
  maxSetBase: number
  masterSet: number
}> {
  console.log('   🖼️  Récupération des métadonnées de la série...')

  await page.goto(seriesUrl, {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  const metadata = await page.evaluate(() => {
    // Chercher l'image de la série (généralement une bannière en haut)
    const possibleSelectors = [
      'img[src*="/series/"]',
      '.series-image img',
      '.banner img',
      'img[alt*="série"]',
      'img[alt*="set"]'
    ]

    let imageUrl: string | null = null
    for (const selector of possibleSelectors) {
      const img = document.querySelector(selector) as HTMLImageElement
      if (img?.src && img.src.includes('static')) {
        imageUrl = img.src
        break
      }
    }

    // Essayer de trouver le nombre de cartes
    // Chercher dans le texte de la page
    const bodyText = document.body.innerText
    const setMatch = bodyText.match(/(\d+)\s*cartes?/i)
    const maxSetBase = setMatch ? parseInt(setMatch[1]) : 200 // Défaut approximatif

    return {
      imageUrl,
      maxSetBase,
      masterSet: Math.floor(maxSetBase * 1.2) // Estimation: +20% pour les variantes
    }
  })

  console.log(`   ✅ Métadonnées: ${metadata.maxSetBase} cartes de base, ${metadata.masterSet} total`)

  return metadata
}

/**
 * Crée ou met à jour la série dans la base de données
 */
async function upsertSeries(gameId: string, seriesConfig: SeriesConfig, metadata: {
  imageUrl: string | null
  maxSetBase: number
  masterSet: number
}) {
  logger.processing('Création/mise à jour de la série...')

  const { data: existingSeries } = await supabase
    .from('series')
    .select('*')
    .eq('code', seriesConfig.code)
    .single()

  // Si on a une image, l'uploader sur Supabase Storage
  let finalImageUrl = metadata.imageUrl

  if (metadata.imageUrl) {
    logger.upload('Upload de l\'image de la série...')
    const uploadResult = await uploadSeriesImage(metadata.imageUrl, seriesConfig.code)

    if (uploadResult.success) {
      finalImageUrl = uploadResult.url!
      logger.success('Image de série uploadée')
    } else {
      logger.warn('Échec upload image série, utilisation URL originale')
    }
  }

  const seriesData = {
    tcg_game_id: gameId,
    name: seriesConfig.name,
    code: seriesConfig.code,
    max_set_base: metadata.maxSetBase,
    master_set: metadata.masterSet,
    release_date: new Date().toISOString().split('T')[0], // Date du jour par défaut
    image_url: finalImageUrl
  }

  if (existingSeries) {
    const { data, error } = await supabase
      .from('series')
      .update(seriesData)
      .eq('id', existingSeries.id)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur mise à jour série: ${error.message}`)
    }

    logger.success('Série mise à jour')
    return data
  } else {
    const { data, error } = await supabase
      .from('series')
      .insert(seriesData)
      .select()
      .single()

    if (error) {
      throw new Error(`Erreur création série: ${error.message}`)
    }

    logger.success('Série créée')
    return data
  }
}

/**
 * Scrape toutes les pages d'une série
 */
async function scrapeSeriesPages(page: any, seriesUrl: string, seriesCode: string): Promise<string[]> {
  console.log('\n🕷️  Scraping des cartes de la série...')

  await page.goto(seriesUrl, {
    waitUntil: 'networkidle0',
    timeout: 30000
  })

  console.log('✅ Page chargée')

  // Attendre que les cartes soient visibles
  await page.waitForSelector('a[href^="/cards/"]', { timeout: 10000 })

  const allCardUrls = new Set<string>()
  let currentPage = 1
  let hasMorePages = true

  while (hasMorePages) {
    console.log(`\n📄 Scraping page ${currentPage}...`)

    // Attendre un peu pour que le contenu se charge
    await delay(1000)

    // Extraire les URLs des cartes sur cette page
    const cardUrls = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/cards/"]'))
      return links
        .map(link => (link as HTMLAnchorElement).href)
        .filter(href => href.includes('/cards/'))
    })

    // Ajouter au Set (évite les doublons)
    cardUrls.forEach(url => allCardUrls.add(url))

    console.log(`   ✅ ${cardUrls.length} cartes trouvées sur cette page`)
    console.log(`   📊 Total: ${allCardUrls.size} cartes uniques`)

    // Chercher le bouton de page suivante
    const nextPageButton = await page.evaluate((page) => {
      const buttons = Array.from(document.querySelectorAll('.pagination .page-item'))

      // Trouver le bouton avec le numéro de page suivante
      const nextPage = page + 1
      const nextButton = buttons.find(item => {
        const span = item.querySelector('.page-link')
        return span?.textContent?.trim() === nextPage.toString()
      })

      return nextButton ? nextPage : null
    }, currentPage)

    if (nextPageButton) {
      console.log(`   ⏭️  Passage à la page ${nextPageButton}...`)

      // Cliquer sur le bouton de la page suivante
      await page.evaluate((pageNum) => {
        const buttons = Array.from(document.querySelectorAll('.pagination .page-item'))
        const targetButton = buttons.find(item => {
          const span = item.querySelector('.page-link')
          return span?.textContent?.trim() === pageNum.toString()
        })

        if (targetButton) {
          const span = targetButton.querySelector('.page-link') as HTMLElement
          span.click()
        }
      }, nextPageButton)

      // Attendre que la page change
      await delay(DELAYS.betweenPages)

      // Attendre que les nouvelles cartes apparaissent
      await page.waitForSelector('a[href^="/cards/"]', { timeout: 10000 })

      currentPage = nextPageButton
    } else {
      console.log('   🏁 Dernière page atteinte')
      hasMorePages = false
    }

    // Sécurité: ne pas dépasser 20 pages
    if (currentPage > 20) {
      console.log('   ⚠️  Limite de sécurité atteinte (20 pages)')
      break
    }
  }

  console.log(`\n✅ ${allCardUrls.size} URLs de cartes collectées au total`)
  return Array.from(allCardUrls)
}

/**
 * Traite toutes les cartes et prépare les données
 */
function processCards(cardUrls: string[], seriesCode: string, setNumber?: number): LorcanaCard[] {
  logger.processing(`Traitement de ${cardUrls.length} cartes...`)

  const cards: LorcanaCard[] = []

  for (const url of cardUrls) {
    const parsed = parseCardUrl(url, { seriesCode, setNumber })
    if (!parsed) {
      logger.warn(`Impossible de parser: ${url}`)
      continue
    }

    cards.push({
      name: parsed.name,
      number: parsed.number,
      language: parsed.language,
      chapter: parsed.chapter,
      rarity: 'Common',
      imageUrl: parsed.imageUrl,
      attributes: {
        slug: parsed.slug
      }
    })
  }

  // Trier par numéro
  cards.sort((a, b) => parseInt(a.number) - parseInt(b.number))

  logger.success(`${cards.length} cartes traitées`)
  return cards
}

/**
 * Insère les cartes dans la base de données
 */
async function insertCards(seriesId: string, cards: LorcanaCard[], seriesCode: string) {
  console.log(`\n💾 Insertion de ${cards.length} cartes dans la base de données...`)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < cards.length; i++) {
    const card = cards[i]

    try {
      console.log(`\n[${i + 1}/${cards.length}] #${card.number} - ${card.name}`)

      // Upload de l'image sur Supabase Storage
      console.log(`   📥 Upload de l'image...`)

      const imageResult = await uploadCardImage(card.imageUrl, card.number, seriesCode)

      const imageUrl = imageResult.success ? imageResult.url! : card.imageUrl

      if (!imageResult.success) {
        console.warn(`   ⚠️  Échec upload, utilisation URL originale`)
      }

      // Insertion dans la base de données
      const { error } = await supabase
        .from('cards')
        .upsert({
          series_id: seriesId,
          name: card.name,
          number: card.number,
          language: card.language,
          chapter: card.chapter,
          rarity: card.rarity,
          image_url: imageUrl,
          attributes: card.attributes
        }, {
          onConflict: 'series_id,number',
          ignoreDuplicates: false
        })

      if (error) {
        console.error(`   ❌ Erreur insertion:`, error.message)
        errorCount++
      } else {
        console.log(`   ✅ Carte insérée`)
        successCount++
      }

      // Rate limiting
      if (i < cards.length - 1) {
        await delay(DELAYS.betweenUploads)
      }

    } catch (error) {
      console.error(`   ❌ Erreur:`, error)
      errorCount++
    }
  }

  console.log(`\n📊 Résumé de l'insertion:`)
  console.log(`   ✅ Succès: ${successCount}`)
  console.log(`   ❌ Erreurs: ${errorCount}`)
  console.log(`   📈 Total: ${cards.length}`)
}

/**
 * Traite une série complète
 */
async function processSeries(browser: any, gameId: string, seriesConfig: SeriesConfig) {
  console.log('\n' + '='.repeat(80))
  console.log(`🎴 Traitement de la série: ${seriesConfig.name} (${seriesConfig.code})`)
  console.log('='.repeat(80))

  const page = await browser.newPage()

  // Configurer le User-Agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    // Étape 1: Récupérer les métadonnées de la série
    let metadata
    if (seriesConfig.imageUrl) {
      // Utiliser l'URL d'image fournie dans la config
      console.log('   🖼️  Utilisation de l\'image configurée...')
      metadata = {
        imageUrl: seriesConfig.imageUrl,
        maxSetBase: seriesConfig.maxSetBase || 200, // Utiliser la config ou valeur par défaut
        masterSet: seriesConfig.masterSet || 240  // Utiliser la config ou valeur par défaut
      }
    } else {
      // Scraper les métadonnées si pas d'URL fournie
      metadata = await scrapeSeriesMetadata(page, seriesConfig.url)
    }

    // Étape 2: Créer/mettre à jour la série
    const series = await upsertSeries(gameId, seriesConfig, metadata)

    // Étape 3: Scraper toutes les pages
    const cardUrls = await scrapeSeriesPages(page, seriesConfig.url, seriesConfig.code)

    if (cardUrls.length === 0) {
      console.warn('\n⚠️  Aucune URL de carte trouvée.')
      return
    }

    // Étape 4: Traiter les cartes
    const cards = processCards(cardUrls, seriesConfig.code, seriesConfig.setNumber)

    if (cards.length === 0) {
      console.warn('\n⚠️  Aucune carte n\'a pu être traitée.')
      return
    }

    // Étape 5: Insérer les cartes
    await insertCards(series.id, cards, seriesConfig.code)

    console.log(`\n✅ Série ${seriesConfig.name} terminée avec succès!`)

  } catch (error) {
    console.error(`\n❌ Erreur lors du traitement de ${seriesConfig.name}:`, error)
  } finally {
    await page.close()
  }
}

/**
 * Script principal
 */
async function main() {
  console.log('🎴 Scraping de TOUTES les séries Lorcana')
  console.log('='.repeat(80))
  console.log('🤖 Utilisation de Puppeteer (navigateur headless)')

  // Filtrer les séries à traiter
  const seriesToProcess = ALL_SERIES.filter(s => !s.skip)

  console.log(`\n📋 Séries à traiter: ${seriesToProcess.length}`)
  seriesToProcess.forEach((s, i) => {
    console.log(`   ${i + 1}. ${s.code} - ${s.name}`)
  })

  try {
    // Étape 1: Créer le bucket si nécessaire
    console.log('\n📦 Vérification du bucket Supabase Storage...')
    await createLorcanaBucket()

    // Étape 2: Récupérer l'ID du jeu Lorcana
    console.log('\n🔍 Recherche du TCG Lorcana...')
    const gameId = await getLorcanaGameId()
    console.log('✅ Lorcana trouvé:', gameId)

    // Étape 3: Lancer le navigateur
    console.log('\n🌐 Lancement du navigateur...')
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    })

    // Étape 4: Traiter chaque série
    for (let i = 0; i < seriesToProcess.length; i++) {
      const seriesConfig = seriesToProcess[i]

      console.log(`\n\n📊 Progression: ${i + 1}/${seriesToProcess.length}`)

      await processSeries(browser, gameId, seriesConfig)

      // Pause entre les séries
      if (i < seriesToProcess.length - 1) {
        logger.info(`Pause de ${DELAYS.betweenSeries / 1000}s avant la prochaine série...`)
        await delay(DELAYS.betweenSeries)
      }
    }

    await browser.close()
    console.log('\n🌐 Navigateur fermé')

    console.log('\n' + '='.repeat(80))
    console.log('🎉 Scraping de toutes les séries terminé avec succès!')
    console.log(`\n🌐 Consultez vos cartes: http://localhost:3000/lorcana/series`)

  } catch (error) {
    console.error('\n❌ Erreur fatale:', error)
    process.exit(1)
  }
}

// Exécution du script
main()
