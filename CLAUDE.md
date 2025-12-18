# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CollectorVerse TCG is a Next.js 15 application for managing trading card game (TCG) collections. It supports multiple TCGs including Pokemon, Disney Lorcana, One Piece Card Game, Riftbound, and Star Wars Unlimited.

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

# Pokemon McDonald's Collections
npx tsx scripts/seed-pokemon-mcdonalds.ts --dry-run    # Preview McDonald's collections
npx tsx scripts/seed-pokemon-mcdonalds.ts              # Seed all McDonald's sets (~136 cards)
npx tsx scripts/seed-pokemon-mcdonalds.ts --set=mcd19  # Seed specific McDonald's set

# Image Generation (Higgsfield AI)
npx tsx scripts/generate-pokemon-images.ts    # Generate Pokemon series banners
npx tsx scripts/generate-onepiece-images.ts   # Generate One Piece series banners

# Image Management
npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run  # Preview Pokemon image copies from EN
npx tsx scripts/copy-pokemon-images-from-en.ts            # Copy missing Pokemon images from EN to other langs
npx tsx scripts/analyze-image-reuse.ts                    # Analyze which images can be reused
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

## Pokemon - McDonald's Collections

### Overview

Pokemon McDonald's promotional cards are seeded from the pokemontcg.io API (https://api.pokemontcg.io/v2). The API provides comprehensive data for 10 McDonald's sets (~136 cards total). The script implements exponential backoff retry logic to handle potential API slowness and rate limiting.

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-pokemon-mcdonalds.ts` | Seed all McDonald's collections from pokemontcg.io API |

### Configuration

- **API**: https://api.pokemontcg.io/v2
- **Storage bucket**: `pokemon-cards`
- **Language**: en (McDonald's cards are English only)
- **Sets**: mcd11, mcd12, mcd14, mcd15, mcd16, mcd17, mcd18, mcd19, mcd21, mcd22 (10 sets)
- **Retry logic**: 5 retries with exponential backoff (2s to 30s max delay)

### Available Sets

```
mcd11 - McDonald's Collection 2011
mcd12 - McDonald's Collection 2012
mcd14 - McDonald's Collection 2014
mcd15 - McDonald's Collection 2015
mcd16 - McDonald's Collection 2016
mcd17 - McDonald's Collection 2017
mcd18 - McDonald's Collection 2018
mcd19 - McDonald's Collection 2019
mcd21 - McDonald's Collection 2021
mcd22 - McDonald's Collection 2022
```

### Usage

```bash
# Preview all sets (dry-run)
npx tsx scripts/seed-pokemon-mcdonalds.ts --dry-run

# Seed all McDonald's sets (~136 cards)
npx tsx scripts/seed-pokemon-mcdonalds.ts

# Seed specific set only
npx tsx scripts/seed-pokemon-mcdonalds.ts --set=mcd19

# Test with limited cards
npx tsx scripts/seed-pokemon-mcdonalds.ts --limit=10 --dry-run
```

### How It Works

1. **Fetch sets**: Query API for all McDonald's sets using `q=name:mcdonald*`
2. **Filter sets**: Only process known McDonald's set codes (mcd11-mcd22)
3. **Create series**: Upsert each set into `series` table with metadata
4. **Fetch cards**: For each set, query `GET /v2/cards?q=set.id:{setId}`
5. **Download images**: Download card images (large or small) from API response
6. **Optimize images**: Sharp optimization (480x672 WebP 85%)
7. **Upload to storage**: Store in `pokemon-cards/{setCode}/en/{cardNumber}.webp`
8. **Update database**: Insert/update card in `cards` table with all attributes

### Retry & Rate Limiting

The script implements exponential backoff for API requests:
- **Initial delay**: 2 seconds
- **Max delay**: 30 seconds
- **Max retries**: 5 attempts
- **Rate limit handling**: Detects HTTP 429 and automatically retries with backoff

### Data Structure

Each card includes:
- Basic info: name, number, rarity, artist
- Pokemon stats: HP, types, subtypes
- Game mechanics: attacks, abilities, weaknesses, resistances, retreat cost
- Metadata: regulation mark, Pokedex numbers, evolvesFrom
- Images: Optimized WebP stored in Supabase Storage

### Troubleshooting

1. **"API timeout"**: Script will automatically retry with exponential backoff
2. **"Rate limited (429)"**: Script detects this and waits before retrying
3. **"Set not found"**: Verify set code exists in `MCDONALDS_SETS` array
4. **"Failed to fetch cards"**: Check internet connection, API may be temporarily down

---

## Pokemon - Image Download

### Overview

Pokemon cards are downloaded from TCGdex API (https://api.tcgdex.net). The process involves:
1. Analyzing missing images in Supabase storage vs cards in database
2. Downloading images from TCGdex assets (https://assets.tcgdex.net)
3. Optimizing (Sharp: 480x672 WebP 85%) and uploading to Supabase storage
4. Updating card `image_url` in database

### Scripts

| Script | Purpose |
|--------|---------|
| `scripts/seed-pokemon.ts` | Seed Pokemon data from TCGdex API |
| `scripts/analyze-pokemon-images.ts` | Analyze missing images (dry-run) |
| `scripts/download-missing-pokemon-images.ts` | Download all missing images |

### Configuration

- **API**: https://api.tcgdex.net/v2
- **Assets**: https://assets.tcgdex.net
- **Storage bucket**: `pokemon-cards`
- **Languages**: en, fr, es, it, pt, de
- **Card ID**: Stored in `cards.tcgdex_id` column

### Usage - Analyze Missing Images

```bash
# Analyze all Pokemon images
npx tsx scripts/analyze-pokemon-images.ts
```

The script will:
- Count total cards in database
- Count total images in storage
- Identify cards without images
- Generate a detailed report in `scripts/logs/pokemon-images-analysis.json`

### Usage - Download Missing Images

```bash
# Analyze what's missing (dry-run)
npx tsx scripts/download-missing-pokemon-images.ts --dry-run

# Download ALL missing images
npx tsx scripts/download-missing-pokemon-images.ts

# Download specific series only
npx tsx scripts/download-missing-pokemon-images.ts --series swsh3

# Limit number of cards (for testing)
npx tsx scripts/download-missing-pokemon-images.ts --limit 50

# Continue on errors
npx tsx scripts/download-missing-pokemon-images.ts --continue-on-error
```

### Image URL Construction

TCGdex uses a specific URL pattern for card images:

```typescript
// TCGdex ID format: {setCode}-{cardNumber}
// Example: swsh3-143

// Image URL: https://assets.tcgdex.net/{lang}/{setCode}/{cardNumber}/high.webp
// Example: https://assets.tcgdex.net/en/swsh3/143/high.webp

// Fallback to PNG if WebP fails:
// https://assets.tcgdex.net/en/swsh3/143/high.png
```

### Storage Structure

```
pokemon-cards/
├── swsh3/
│   ├── en/
│   │   ├── 1.webp
│   │   ├── 2.webp
│   │   └── ...
│   ├── fr/
│   │   └── ...
│   └── de/
│       └── ...
├── base1/
│   └── en/
│       └── ...
└── series/
    ├── swsh3.webp
    └── ...
```

### Progress & Recovery

The download script saves progress to `scripts/logs/pokemon-download-progress.json`:
- Tracks processed card IDs
- Counts success, errors, and not found
- Allows resuming after interruption
- Automatically cleaned up on successful completion

### Troubleshooting

1. **"Image non trouvée (404)"**: Card image doesn't exist in TCGdex, try checking tcgdex_id
2. **Missing tcgdex_id**: Script attempts to construct ID as `{seriesCode}-{cardNumber}`
3. **WebP fails**: Script automatically falls back to PNG format

## Pokemon - Image Copy from EN to Other Languages

### Overview

Many Pokemon cards share the same artwork across languages. Instead of downloading the same image multiple times, this script copies existing EN images to other languages (DE, FR, IT, ES, PT) when they are missing.

### Script

`scripts/copy-pokemon-images-from-en.ts` - Copy missing Pokemon images from EN to other languages

**Full documentation**: See `scripts/README-COPY-POKEMON-IMAGES.md`

### Quick Start

```bash
# Preview what would be copied (dry-run)
npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run

# Copy all missing images from EN
npx tsx scripts/copy-pokemon-images-from-en.ts

# Copy specific series
npx tsx scripts/copy-pokemon-images-from-en.ts --series dp6

# Copy specific language only
npx tsx scripts/copy-pokemon-images-from-en.ts --lang fr

# Limit number of copies (for testing)
npx tsx scripts/copy-pokemon-images-from-en.ts --limit 50

# Combine options
npx tsx scripts/copy-pokemon-images-from-en.ts --series dp6 --lang fr --dry-run
```

### How It Works

1. **Identify cards to process**:
   - Cards without `image_url` in target language
   - Same series + same card number has `image_url` in EN

2. **Copy images in Supabase Storage**:
   - Source: `pokemon-cards/{series}/en/{number}.webp`
   - Destination: `pokemon-cards/{series}/{lang}/{number}.webp`
   - Uses `supabase.storage.from('pokemon-cards').copy(source, dest)`

3. **Update database**:
   - Update `cards.image_url` with new public URL

### Progress & Recovery

Progress is saved to `scripts/logs/pokemon-copy-progress.json`:
- Tracks processed card IDs (skips them on resume)
- Saves every 10 copies
- Auto-deleted when all tasks complete successfully
- Simply rerun the script to resume after interruption

### Statistics

Based on `scripts/analyze-image-reuse.ts`:
- **~6,600 images** can be copied from EN
- Top series with reusable images:
  - `smp`: 699 images
  - `swshp`: 468 images
  - `dp6`: 292 images
  - `dp3`: 264 images
  - `dp2`: 248 images

### Configuration

- **Target languages**: de, fr, it, es, pt (EN is source)
- **Delay between copies**: 100ms (to avoid overloading Supabase)
- **Batch size**: 1000 cards (pagination)
- **Storage bucket**: `pokemon-cards`

### Notes

- Series codes must be **lowercase** (use `dp6`, not `DP6`)
- Only copies if EN image exists AND target image doesn't
- Uses Supabase Storage `.copy()` API (fast, no download/upload)
- Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

