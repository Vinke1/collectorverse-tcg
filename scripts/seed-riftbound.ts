/**
 * Script de scraping pour les cartes Riftbound avec Puppeteer
 * Source: https://riftbound.leagueoflegends.com/en-us/card-gallery/
 *
 * Usage: npm run seed:riftbound
 *
 * Ce script extrait les données JSON directement depuis la page Next.js
 * et télécharge toutes les cartes avec leurs images.
 */

import puppeteer from 'puppeteer'
import { createRiftboundBucket, uploadRiftboundCardImage, uploadRiftboundIcon } from '../lib/supabase/storage'
import { createAdminClient } from './lib/supabase'
import { delay } from './lib/utils'
import { logger } from './lib/logger'
import { DELAYS } from '../lib/constants/app-config'

// Configuration
const GALLERY_URL = 'https://riftbound.leagueoflegends.com/en-us/card-gallery/'

// Initialize Supabase admin client
const supabase = createAdminClient()

// Types pour les cartes Riftbound
interface RiftboundCardRaw {
  id: string
  name: string
  collectorNumber: number
  publicCode: string
  set: {
    value: {
      id: string
      label: string
    }
  }
  domain: {
    values: Array<{
      id: string
      label: string
      icon?: { url: string }
    }>
  }
  cardType: {
    type: Array<{
      id: string
      label: string
      icon?: { url: string }
    }>
    superType?: Array<{
      id: string
      label: string
      icon?: { url: string }
    }>
  }
  rarity: {
    value: {
      id: string
      label: string
      icon?: { url: string }
    }
  }
  cardImage: {
    url: string
  }
  energy?: {
    value: {
      id: string | number
      label: string
    }
  }
  might?: {
    value: {
      id: string | number
      label: string
    }
  }
  text?: {
    richText?: {
      body: string
    }
  }
  illustrator?: {
    values: Array<{
      id: string
      label: string
    }>
  }
  tags?: {
    tags: string[]
  }
}

interface RiftboundCard {
  name: string
  number: string
  seriesCode: string
  publicCode: string
  rarity: string
  imageUrl: string
  domains: string[]
  cardType: string
  superType: string | null
  energy: number | null
  might: number | null
  text: string | null
  illustrator: string | null
  tags: string[]
}

interface IconData {
  type: 'domains' | 'card_types' | 'rarities'
  code: string
  name: string
  url: string
}

/**
 * Récupère l'UUID du TCG Riftbound
 */
async function getRiftboundGameId(): Promise<string> {
  const { data, error } = await supabase
    .from('tcg_games')
    .select('id')
    .eq('slug', 'riftbound')
    .single()

  if (error || !data) {
    throw new Error('TCG Riftbound non trouvé dans la base de données')
  }

  return data.id
}

/**
 * Récupère l'ID d'une série par son code
 */
async function getSeriesId(seriesCode: string): Promise<string> {
  const { data, error } = await supabase
    .from('series')
    .select('id')
    .eq('code', seriesCode)
    .single()

  if (error || !data) {
    throw new Error(`Série ${seriesCode} non trouvée. Avez-vous exécuté la migration SQL ?`)
  }

  return data.id
}

/**
 * Scrape la galerie Riftbound avec Puppeteer
 */
async function scrapeRiftboundGallery(): Promise<{ cards: RiftboundCardRaw[], icons: IconData[] }> {
  logger.section('Lancement du navigateur Puppeteer')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const page = await browser.newPage()

  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

  try {
    logger.web(`Navigation vers: ${GALLERY_URL}`)

    await page.goto(GALLERY_URL, {
      waitUntil: 'networkidle0',
      timeout: 60000
    })

    logger.success('Page chargée')

    // Attendre que le contenu soit chargé
    await delay(3000)

    // Extraire les données depuis __NEXT_DATA__
    logger.processing('Extraction des données JSON...')

    const data = await page.evaluate(() => {
      // Chercher le script __NEXT_DATA__
      const scriptTag = document.getElementById('__NEXT_DATA__')
      if (!scriptTag) {
        throw new Error('Script __NEXT_DATA__ non trouvé')
      }

      const jsonData = JSON.parse(scriptTag.textContent || '{}')

      // Naviguer dans la structure pour trouver les cartes
      // Chemin: props.pageProps.page.blades[].cards.items
      const pageProps = jsonData?.props?.pageProps
      const blades = pageProps?.page?.blades || []

      // Trouver le blade de type "riftboundCardGallery"
      const galleryBlade = blades.find((blade: any) => blade.type === 'riftboundCardGallery')
      const cards = galleryBlade?.cards?.items || []

      return { cards, pageProps }
    })

    if (!data.cards || data.cards.length === 0) {
      throw new Error('Aucune carte trouvée dans les données JSON')
    }

    logger.success(`${data.cards.length} cartes trouvées dans le JSON`)

    // Collecter les icônes uniques
    const icons: IconData[] = []
    const seenIcons = new Set<string>()

    for (const card of data.cards as RiftboundCardRaw[]) {
      // Domains
      if (card.domain?.values) {
        for (const domain of card.domain.values) {
          const key = `domains:${domain.id}`
          if (!seenIcons.has(key) && domain.icon?.url) {
            seenIcons.add(key)
            icons.push({
              type: 'domains',
              code: domain.id,
              name: domain.label,
              url: domain.icon.url
            })
          }
        }
      }

      // Card Types
      if (card.cardType?.type) {
        for (const type of card.cardType.type) {
          const key = `card_types:${type.id}`
          if (!seenIcons.has(key) && type.icon?.url) {
            seenIcons.add(key)
            icons.push({
              type: 'card_types',
              code: type.id,
              name: type.label,
              url: type.icon.url
            })
          }
        }
      }

      // SuperTypes
      if (card.cardType?.superType) {
        for (const superType of card.cardType.superType) {
          const key = `card_types:${superType.id}`
          if (!seenIcons.has(key) && superType.icon?.url) {
            seenIcons.add(key)
            icons.push({
              type: 'card_types',
              code: superType.id,
              name: superType.label,
              url: superType.icon.url
            })
          }
        }
      }

      // Rarities
      if (card.rarity?.value) {
        const key = `rarities:${card.rarity.value.id}`
        if (!seenIcons.has(key) && card.rarity.value.icon?.url) {
          seenIcons.add(key)
          icons.push({
            type: 'rarities',
            code: card.rarity.value.id,
            name: card.rarity.value.label,
            url: card.rarity.value.icon.url
          })
        }
      }
    }

    logger.success(`${icons.length} icônes uniques collectées`)

    return { cards: data.cards, icons }

  } catch (error) {
    logger.error(`Erreur lors du scraping: ${error}`)
    throw error
  } finally {
    await browser.close()
    logger.info('Navigateur fermé')
  }
}

/**
 * Traite les données brutes en format normalisé
 */
function processCards(rawCards: RiftboundCardRaw[]): RiftboundCard[] {
  logger.processing(`Traitement de ${rawCards.length} cartes...`)

  const cards: RiftboundCard[] = []

  for (const raw of rawCards) {
    try {
      const card: RiftboundCard = {
        name: raw.name,
        number: raw.collectorNumber.toString(),
        seriesCode: raw.set?.value?.id?.toUpperCase() || 'OGN',
        publicCode: raw.publicCode || `${raw.set?.value?.id?.toUpperCase()}-${raw.collectorNumber}`,
        rarity: raw.rarity?.value?.id || 'common',
        imageUrl: raw.cardImage?.url || '',
        domains: raw.domain?.values?.map(d => d.id) || [],
        cardType: raw.cardType?.type?.[0]?.id || 'unit',
        superType: raw.cardType?.superType?.[0]?.id || null,
        energy: raw.energy?.value?.id ? parseInt(raw.energy.value.id.toString()) : null,
        might: raw.might?.value?.id ? parseInt(raw.might.value.id.toString()) : null,
        text: raw.text?.richText?.body || null,
        illustrator: raw.illustrator?.values?.[0]?.label || null,
        tags: raw.tags?.tags || []
      }

      if (card.imageUrl) {
        cards.push(card)
      } else {
        logger.warn(`Carte ${raw.name} ignorée (pas d'image)`)
      }
    } catch (error) {
      logger.error(`Erreur traitement carte ${raw.name}: ${error}`)
    }
  }

  logger.success(`${cards.length} cartes traitées`)
  return cards
}

/**
 * Upload les icônes vers Supabase Storage et met à jour la base
 */
async function uploadIcons(icons: IconData[], gameId: string) {
  logger.section(`Upload de ${icons.length} icônes`)

  for (const icon of icons) {
    try {
      logger.processing(`Upload icône ${icon.type}/${icon.code}...`)

      const result = await uploadRiftboundIcon(icon.url, icon.type, icon.code)

      if (result.success && result.url) {
        // Mettre à jour l'URL dans la base de données
        const table = icon.type
        const { error } = await supabase
          .from(table)
          .update({ icon_url: result.url })
          .eq('tcg_game_id', gameId)
          .eq('code', icon.code)

        if (error) {
          logger.warn(`Échec mise à jour DB pour ${icon.code}: ${error.message}`)
        } else {
          logger.success(`Icône ${icon.code} uploadée et DB mise à jour`)
        }
      }

      await delay(DELAYS.betweenUploads)
    } catch (error) {
      logger.error(`Erreur upload icône ${icon.code}: ${error}`)
    }
  }
}

/**
 * Insère les cartes dans la base de données
 */
async function insertCards(cards: RiftboundCard[]) {
  logger.section(`Insertion de ${cards.length} cartes`)

  // Grouper par série
  const cardsBySeries = new Map<string, RiftboundCard[]>()
  for (const card of cards) {
    const existing = cardsBySeries.get(card.seriesCode) || []
    existing.push(card)
    cardsBySeries.set(card.seriesCode, existing)
  }

  let totalSuccess = 0
  let totalError = 0

  for (const [seriesCode, seriesCards] of cardsBySeries) {
    logger.info(`\nSérie ${seriesCode}: ${seriesCards.length} cartes`)

    let seriesId: string
    try {
      seriesId = await getSeriesId(seriesCode)
    } catch (error) {
      logger.error(`Série ${seriesCode} non trouvée, création...`)

      // Créer la série si elle n'existe pas
      const gameId = await getRiftboundGameId()
      const { data, error: insertError } = await supabase
        .from('series')
        .insert({
          tcg_game_id: gameId,
          name: seriesCode,
          code: seriesCode,
          max_set_base: seriesCards.length,
          master_set: seriesCards.length
        })
        .select()
        .single()

      if (insertError || !data) {
        logger.error(`Impossible de créer la série ${seriesCode}`)
        continue
      }
      seriesId = data.id
    }

    for (let i = 0; i < seriesCards.length; i++) {
      const card = seriesCards[i]

      try {
        logger.progress(`[${i + 1}/${seriesCards.length}] ${card.name}`)

        // Upload de l'image
        const imageResult = await uploadRiftboundCardImage(
          card.imageUrl,
          card.number,
          card.seriesCode
        )

        const finalImageUrl = imageResult.success ? imageResult.url! : card.imageUrl

        // Insertion dans la base de données
        const { error } = await supabase
          .from('cards')
          .upsert({
            series_id: seriesId,
            name: card.name,
            number: card.number,
            language: 'EN',
            rarity: card.rarity,
            image_url: finalImageUrl,
            attributes: {
              domains: card.domains,
              card_type: card.cardType,
              supertype: card.superType,
              energy: card.energy,
              might: card.might,
              text: card.text,
              illustrator: card.illustrator,
              tags: card.tags,
              public_code: card.publicCode
            }
          }, {
            onConflict: 'series_id,number,language',
            ignoreDuplicates: false
          })

        if (error) {
          logger.error(`Erreur insertion ${card.name}: ${error.message}`)
          totalError++
        } else {
          logger.success(`Carte ${card.name} insérée`)
          totalSuccess++
        }

        // Rate limiting
        if (i < seriesCards.length - 1) {
          await delay(DELAYS.betweenUploads)
        }

      } catch (error) {
        logger.error(`Erreur carte ${card.name}: ${error}`)
        totalError++
      }
    }

    // Pause entre les séries
    await delay(DELAYS.betweenSeries)
  }

  logger.section('Résumé insertion')
  logger.success(`Succès: ${totalSuccess}`)
  logger.error(`Erreurs: ${totalError}`)
  logger.info(`Total: ${cards.length}`)
}

/**
 * Script principal
 */
async function main() {
  logger.section('Scraping Riftbound Card Gallery')
  console.log('Source: https://riftbound.leagueoflegends.com/en-us/card-gallery/')

  try {
    // Étape 1: Créer le bucket
    logger.info('\n1. Vérification du bucket Supabase Storage...')
    await createRiftboundBucket()

    // Étape 2: Vérifier que Riftbound existe
    logger.info('\n2. Vérification du TCG Riftbound...')
    const gameId = await getRiftboundGameId()
    logger.success(`Riftbound trouvé: ${gameId}`)

    // Étape 3: Scraper la galerie
    logger.info('\n3. Scraping de la galerie...')
    const { cards: rawCards, icons } = await scrapeRiftboundGallery()

    // Étape 4: Upload des icônes
    if (icons.length > 0) {
      logger.info('\n4. Upload des icônes...')
      await uploadIcons(icons, gameId)
    }

    // Étape 5: Traiter les cartes
    logger.info('\n5. Traitement des cartes...')
    const cards = processCards(rawCards)

    if (cards.length === 0) {
      logger.warn('Aucune carte à insérer.')
      process.exit(1)
    }

    // Étape 6: Insérer les cartes
    logger.info('\n6. Insertion des cartes...')
    await insertCards(cards)

    logger.section('Scraping terminé avec succès!')
    console.log('\nConsultez vos cartes: http://localhost:3000/series/riftbound')

  } catch (error) {
    logger.error(`Erreur fatale: ${error}`)
    process.exit(1)
  }
}

// Exécution
main()
