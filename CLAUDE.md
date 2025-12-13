# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CollectorVerse TCG is a Next.js 15 application for managing trading card game (TCG) collections. It supports multiple TCGs including Pokemon, Disney Lorcana, One Piece Card Game, Riftbound, and Naruto.

**Tech Stack:**
- Next.js 15 with App Router (TypeScript)
- Supabase (PostgreSQL + Auth + Storage)
- Tailwind CSS + Shadcn/ui + Radix UI
- Framer Motion for animations
- PWA support with @ducanh2912/next-pwa

## Development Commands

```bash
# Development
npm run dev                        # Start dev server (Turbopack) at localhost:3000
npm run build                      # Production build
npm run lint                       # Run ESLint

# Database & Data Seeding
npm run seed:lorcana               # Scrape and seed single Lorcana series
npm run seed:all-lorcana           # Scrape and seed all Lorcana series

# Image Generation (Higgsfield AI)
npx tsx scripts/generate-pokemon-images.ts    # Generate Pokemon series banners
npx tsx scripts/generate-onepiece-images.ts   # Generate One Piece series banners
```

## Project Architecture

### Routing Structure

```
app/
├── page.tsx                         # Homepage with TCG selection
├── series/
│   ├── [tcg]/page.tsx               # Dynamic: /series/{tcg} - TCG series list
│   └── [tcg]/[code]/page.tsx        # Dynamic: /series/{tcg}/{code} - Series cards
├── login/page.tsx                   # Login page
└── auth/                            # Auth callback handling
```

### Supabase Client Patterns

```typescript
// Client Components (browser)
import { createClient } from '@/lib/supabase/client'
const supabase = createClient()

// Server Components/Actions
import { createClient } from '@/lib/supabase/server'
const supabase = await createClient()  // Note: await required

// Admin/Scripts (service role)
import { createAdminClient } from './lib/supabase'
const supabase = createAdminClient()  // Auto-validates env
```

### Database Schema

Core tables:
- **tcg_games**: TCG definitions (id, name, slug, icon, gradient)
- **series**: Card series (tcg_game_id, name, code, max_set_base, master_set, image_url)
- **cards**: Individual cards (series_id, name, number, language, chapter, rarity, image_url, attributes JSONB)
- **user_collections**: User-owned cards (user_id, card_id, owned, quantity)

Card number format: Normal cards as "143", promos as "1/P3" or "2/D100".

### Utility Organization

```
lib/
├── constants/
│   ├── rarities.ts          # 18 rarities with aliases
│   ├── tcg-attributes.ts    # TCG-specific attributes (inks, types)
│   └── app-config.ts        # DELAYS, CARD_DIMENSIONS, SUPPORTED_LANGUAGES
├── utils/
│   ├── card-sorting.ts      # sortCards(), isPromoCard()
│   └── card-formatting.ts   # Card number formatting
└── supabase/                # Client, server, storage helpers

scripts/lib/
├── supabase.ts              # createAdminClient()
├── logger.ts                # Consistent logging (success, error, info, warn)
├── utils.ts                 # delay(), slugToTitle()
└── card-parser.ts           # parseCardUrl()
```

## Environment Variables

Required in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # Required for scripts/admin

# For Higgsfield AI image generation (optional)
HF_API_KEY=
HF_SECRET=
```

## Higgsfield AI - Series Image Generation

Generate banner images (16:9) for TCG series using Higgsfield Cloud API.

### Scripts

| TCG | Script | Prompts File |
|-----|--------|--------------|
| Pokemon | `scripts/generate-pokemon-images.ts` | `scripts/data/pokemon-set-prompts.ts` |
| One Piece | `scripts/generate-onepiece-images.ts` | `scripts/data/onepiece-set-prompts.ts` |

### Usage

```bash
# Dry run (preview prompts without API calls)
npx tsx scripts/generate-pokemon-images.ts --dry-run
npx tsx scripts/generate-onepiece-images.ts --dry-run

# Generate all images
npx tsx scripts/generate-pokemon-images.ts
npx tsx scripts/generate-onepiece-images.ts

# Resume from specific index
npx tsx scripts/generate-pokemon-images.ts --start 50

# Generate specific count
npx tsx scripts/generate-onepiece-images.ts --start 10 --count 5
```

### Configuration

- **API**: `https://platform.higgsfield.ai`
- **Model**: Nano Banana Pro (`/nano-banana-pro`)
- **Format**: 16:9 aspect ratio, 1K resolution
- **Cost**: ~3 credits per image ($1 = 16 credits)
- **Output**: `scripts/output/{tcg}-images/`
- **Progress**: Auto-saved in `scripts/output/{tcg}-images-progress.json`

### Adding a New TCG

1. Create prompts file: `scripts/data/{tcg}-set-prompts.ts`
   ```typescript
   export interface {Tcg}SetPrompt {
     id: string
     name: string
     type: string
     prompt: string
   }

   const BASE_STYLE = `{TCG} official artwork style, 16:9 banner, high quality`

   function createPrompt(setName: string, scene: string): string {
     return `${BASE_STYLE}, ${scene}, with title "${setName}"`
   }

   export const {TCG}_SET_PROMPTS: {Tcg}SetPrompt[] = [
     { id: 'SET01', name: 'Set Name', type: 'booster', prompt: createPrompt('Set Name', 'scene description') },
   ]

   export const TOTAL_PROMPTS = {TCG}_SET_PROMPTS.length
   ```

2. Copy and adapt `generate-pokemon-images.ts` or `generate-onepiece-images.ts`

3. Update output directory and progress file paths in CONFIG

## Card Data Sources

### Lorcana
| Language | Source | URL |
|----------|--------|-----|
| Japanese | Takara Tomy | https://www.takaratomy.co.jp/products/disneylorcana/ |
| English | Dreamborn | https://dreamborn.ink/collection |
| French | Lorcards | https://www.lorcards.fr/series |
| Promos | Cardmarket | https://www.cardmarket.com/fr/Lorcana/Products/Singles/ |

### One Piece
| Language | Source | URL |
|----------|--------|-----|
| French | OPECards | https://www.opecards.fr/series |
| English | OPECards | https://www.opecards.fr/series (prefix `en-`) |
| Japanese | OPECards | https://www.opecards.fr/series (prefix `jp-`) |

### Star Wars Unlimited
| Language | Source | URL |
|----------|--------|-----|
| French | SWUCards | https://www.swucards.fr/series |
| English | SWUCards | https://www.swucards.fr/series |

## Scraping Guidelines

### TCGCards.fr Network (lorcards.fr, opecards.fr, swucards.fr)

**Pagination - Use click-based navigation, NOT URL-based:**

The pagination on tcgcards.fr sites uses dynamic `data-href` attributes that are only available for nearby pages. Always use click-based pagination:

```typescript
// CORRECT: Click-based pagination
let currentPage = 1
let hasMorePages = true

while (hasMorePages && currentPage <= totalPages) {
  // Extract cards from current page
  const pageUrls = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/cards/"]')
    return Array.from(links).map(link => (link as HTMLAnchorElement).href)
  })

  // Navigate to next page by clicking
  if (currentPage < totalPages) {
    const nextPage = currentPage + 1
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
    }, nextPage)

    if (clicked) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      await page.waitForSelector('a[href*="/cards/"]', { timeout: 10000 })
      currentPage = nextPage
    } else {
      hasMorePages = false
    }
  } else {
    hasMorePages = false
  }
}

// WRONG: URL-based pagination (data-href not available for all pages)
// const pageHref = paginationHrefs[currentPage]  // Will be undefined for pages 5+
// await page.goto(`${baseUrl}${pageHref}`)       // FAILS!
```

**Always extract real image URLs from JSON-LD** - never construct URLs manually:

```typescript
const cardData = await page.evaluate((lang: string) => {
  const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
  if (jsonLdScript) {
    const jsonLd = JSON.parse(jsonLdScript.textContent || '{}')
    // Extract imageUrl from jsonLd.image array, filtering by language
  }
  return { imageUrl, cardName }
}, language)
```

### Cardmarket

Images require Puppeteer with Referer header due to anti-hotlinking:

```typescript
await imagePage.setExtraHTTPHeaders({ 'Referer': 'https://www.cardmarket.com/' })
```

### Script Best Practices

```typescript
import { createAdminClient } from './lib/supabase'
import { logger } from './lib/logger'
import { delay } from './lib/utils'
import { DELAYS } from '../lib/constants/app-config'

const supabase = createAdminClient()  // Auto-validates env

logger.section('Processing')
logger.success('Done')
logger.error('Failed')

await delay(DELAYS.betweenPages)      // 2000ms
await delay(DELAYS.betweenUploads)    // 500ms
```

## Important Notes

- **Card sorting**: Use `sortCards()` from `lib/utils/card-sorting.ts`
- **Rarities**: Use `normalizeRarity()` from `lib/constants/rarities.ts`
- **Image processing**: Always use Sharp (480x672 WebP at 85% quality)
- **French locale**: App is in French for UI strings
- **Shadcn/ui**: Install components with `npx shadcn-ui@latest add [component]`

## Star Wars Unlimited - Image Scraping

### Overview

Star Wars Unlimited cards are scraped from swucards.fr (part of TCGCards.fr network). The process involves:
1. Analyzing missing images in Supabase storage vs cards in database
2. Scraping card pages to extract image URLs
3. Downloading, optimizing (Sharp: 480x672 WebP 85%), and uploading to Supabase storage
4. Updating card `image_url` in database

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-starwars.ts` | Scrape and seed a single series |
| `scripts/seed-all-starwars.ts` | Scrape all Star Wars series |
| `scripts/analyze-starwars-images.ts` | Analyze missing images (dry-run) |
| `scripts/download-missing-starwars-images.ts` | Download all missing images |

### Configuration

Series configuration in `scripts/config/starwars-series.ts`:
- Boosters: SOR, SHD, TWI, JTL, LOF, SEC
- Weekly Play: WSOR, WSHD, WTWI, WJTL, WLOF
- Promos: OP

### Usage - Download Missing Images

```bash
# Analyze what's missing (dry-run)
npx tsx scripts/download-missing-starwars-images.ts --dry-run

# Download ALL missing images
npx tsx scripts/download-missing-starwars-images.ts

# Download specific series only
npx tsx scripts/download-missing-starwars-images.ts --series SOR

# Limit number of cards (for testing)
npx tsx scripts/download-missing-starwars-images.ts --limit 50

# Continue on errors
npx tsx scripts/download-missing-starwars-images.ts --continue-on-error
```

### URL Patterns (Important!)

swucards.fr uses **two different URL patterns** depending on the series:

```typescript
// Pattern 1 (older series like SOR): no hyphen between series and lang
// sorofr-001-252-c-directeur-krennic-aspire-au-pouvoir
const match1 = href.match(/\/cards\/[a-z]+(fr|en)-(\d{3})-\d+-[a-z]-/)

// Pattern 2 (newer series like SHD): hyphen between series and lang
// shd-fr-001-262-c-gar-saxon-vice-roi-de-mandalore
const match2 = href.match(/\/cards\/[a-z]+-[a-z]{2}-(\d{3})-\d+-[a-z]-/)
```

Always check both patterns when extracting card URLs.

### Storage Structure

```
starwars-cards/
├── SOR/
│   └── fr/
│       ├── 001.webp
│       ├── 002.webp
│       └── ...
├── SHD/
│   └── fr/
│       └── ...
└── series/
    ├── SOR.webp
    └── ...
```

### Progress & Recovery

The download script saves progress to `scripts/logs/starwars-download-progress.json`:
- Tracks processed card IDs
- Allows resuming after interruption
- Automatically cleaned up on successful completion

### Troubleshooting

1. **"URL non trouvée"**: Check if the URL pattern regex matches the series format
2. **"4 URLs trouvées" when expecting more**: Pagination might not be working - verify click-based navigation
3. **Image extraction fails**: Check JSON-LD script tag on card page, fallback to og:image meta tag

---

## MVP & Go-to-Market Checklist

### Phase 1 : Pré-lancement (Obligatoire avant beta)

#### Infrastructure & Déploiement
- [x] PWA configurée (manifest.json, service worker)
- [x] Auth Supabase fonctionnelle
- [x] Gestion des collections utilisateurs
- [x] Partage de collections
- [x] Support multilingue (FR, EN, JP, ZH)
- [x] Mentions légales et politique de confidentialité
- [x] Footer avec liens légaux
- [ ] Déploiement sur Vercel (gratuit)
- [ ] Configuration domaine personnalisé (optionnel)
- [ ] Variables d'environnement en production

#### Monitoring & Analytics
- [ ] Sentry pour error tracking
- [ ] Analytics (Plausible ou PostHog)
- [ ] Backup automatique BDD Supabase

#### SEO & Performance
- [ ] Sitemap.xml généré
- [ ] robots.txt configuré
- [ ] Open Graph images pour chaque page
- [ ] Lighthouse score > 90

### Phase 2 : Lancement Beta

#### Communautés à cibler
- [ ] Reddit : r/lorcana, r/OnePieceTCG, r/PokemonTCG (posts préparés)
- [ ] Discord : Serveurs TCG français (5-10 serveurs identifiés)
- [ ] Facebook : Groupes collectionneurs FR
- [ ] Twitter/X : Hashtags TCG

#### Contenu & SEO
- [ ] Article "Guide collection Lorcana 2025"
- [ ] Comparatifs sets populaires
- [ ] Landing page optimisée mots-clés

#### Partenariats
- [ ] Liste boutiques locales contactées
- [ ] Influenceurs/YouTubers TCG FR identifiés

### Phase 3 : Croissance

#### Fonctionnalités virales
- [x] Partage collection avec QR code
- [ ] Valeur estimée collection (scrape Cardmarket)
- [ ] Badges/achievements collectionneurs
- [ ] Mode "Wishlist" public

#### Infrastructure (si >1000 users/jour)
- [ ] Upgrade Vercel Pro (20$/mois)
- [ ] Upgrade Supabase Pro (25$/mois)
- [ ] CDN pour images (optionnel)

---

## Guide Déploiement Vercel

### Étape 1 : Préparation

```bash
# Vérifier que le build passe en local
npm run build

# S'assurer que .env.local contient toutes les variables
cat .env.local
```

### Étape 2 : Connexion Vercel

1. Aller sur https://vercel.com
2. Se connecter avec GitHub
3. Cliquer "Add New Project"
4. Importer le repo `CollectorVerse TCG`

### Étape 3 : Configuration

Variables d'environnement à ajouter dans Vercel :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
NEXT_PUBLIC_APP_URL=https://ton-domaine.vercel.app
```

**Note** : Ne PAS ajouter `SUPABASE_SERVICE_ROLE_KEY` en production (scripts uniquement)

### Étape 4 : Déploiement

1. Cliquer "Deploy"
2. Attendre ~2-3 minutes
3. URL générée : `https://collectorverse-tcg.vercel.app`

### Étape 5 : Domaine personnalisé (optionnel)

1. Settings > Domains
2. Ajouter domaine : `collectorverse.fr`
3. Configurer DNS chez registrar :
   - Type A : `76.76.21.21`
   - Type CNAME : `cname.vercel-dns.com`

### Étape 6 : Post-déploiement

```bash
# Vérifier que tout fonctionne
curl -I https://ton-domaine.vercel.app

# Tester les routes critiques
# - / (homepage)
# - /login (auth)
# - /series/lorcana (liste séries)
# - /series/lorcana/FirstChapter (cartes)
```

---

## Informations Légales

### Éditeur du site
- **Nom** : [À COMPLÉTER - Ton nom ou nom société]
- **Adresse** : [À COMPLÉTER]
- **Email** : contact@collectorverse.fr
- **SIRET** : [À COMPLÉTER si applicable]

### Hébergeur
- **Vercel Inc.**
- 440 N Barranca Ave #4133
- Covina, CA 91723, USA

### Données personnelles
- Données stockées : email, préférences langue, collections
- Hébergeur BDD : Supabase (AWS eu-west-1)
- Durée conservation : jusqu'à suppression compte
- Droits RGPD : accès, rectification, suppression via email
