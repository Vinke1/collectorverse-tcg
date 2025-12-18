# Scripts CollectorVerse TCG

Ce dossier contient tous les scripts de données pour CollectorVerse TCG.

## Structure

```
scripts/
├── lib/                    # Utilitaires partagés
│   ├── supabase.ts        # Client Supabase admin
│   ├── logger.ts          # Logging consistant
│   ├── utils.ts           # Helpers (delay, slugToTitle, etc.)
│   └── card-parser.ts     # Parsing URLs de cartes
├── config/                 # Configurations TCG
│   └── starwars-series.ts # Configuration séries Star Wars
├── data/                   # Données de prompts IA
│   ├── pokemon-set-prompts.ts
│   └── onepiece-set-prompts.ts
├── logs/                   # Fichiers de progression
└── output/                 # Images générées
```

## Scripts par TCG

### Pokemon

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-pokemon.ts` | Seed données depuis TCGdex API | `npx tsx scripts/seed-pokemon.ts --lang=en` |
| `seed-pokemon-mcdonalds.ts` | Seed collections McDonald's depuis pokemontcg.io | `npx tsx scripts/seed-pokemon-mcdonalds.ts --dry-run` |
| `analyze-pokemon-images.ts` | Analyser images manquantes | `npx tsx scripts/analyze-pokemon-images.ts` |
| `download-missing-pokemon-images.ts` | Télécharger images manquantes | `npx tsx scripts/download-missing-pokemon-images.ts --limit=50` |
| `generate-pokemon-images.ts` | Générer bannières avec IA | `npx tsx scripts/generate-pokemon-images.ts --dry-run` |
| `upload-pokemon-series-images.ts` | Upload bannières de séries | `npx tsx scripts/upload-pokemon-series-images.ts` |

**Options communes :**
- `--dry-run` : Prévisualiser sans modifications
- `--series=CODE` : Filtrer une série spécifique
- `--set=CODE` : Filtrer un set spécifique (McDonald's uniquement)
- `--limit=N` : Limiter à N cartes
- `--continue-on-error` : Continuer malgré les erreurs

**Données :**
- API TCGdex : https://api.tcgdex.net/v2
- API PokemonTCG.io : https://api.pokemontcg.io/v2
- Assets : https://assets.tcgdex.net
- Bucket : `pokemon-cards`
- ID carte : `cards.tcgdex_id`

**Collections McDonald's disponibles :**
- mcd11, mcd12, mcd14, mcd15, mcd16, mcd17, mcd18, mcd19, mcd21, mcd22 (~136 cartes total)

### Star Wars Unlimited

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-starwars.ts` | Seed une série depuis swucards.fr | `npx tsx scripts/seed-starwars.ts SOR` |
| `seed-all-starwars.ts` | Seed toutes les séries | `npx tsx scripts/seed-all-starwars.ts` |
| `analyze-starwars-images.ts` | Analyser images manquantes | `npx tsx scripts/analyze-starwars-images.ts` |
| `download-missing-starwars-images.ts` | Télécharger images manquantes | `npx tsx scripts/download-missing-starwars-images.ts --dry-run` |

**Options communes :**
- `--dry-run` : Prévisualiser sans modifications
- `--series=CODE` : Filtrer une série (SOR, SHD, etc.)
- `--limit=N` : Limiter à N cartes
- `--continue-on-error` : Continuer malgré les erreurs

**Données :**
- Source : https://www.swucards.fr
- Bucket : `starwars-cards`
- Config : `scripts/config/starwars-series.ts`

### One Piece

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-onepiece.ts` | Seed une série depuis opecards.fr | `npx tsx scripts/seed-onepiece.ts OP01 --lang=fr` |
| `seed-all-onepiece.ts` | Seed toutes les séries | `npx tsx scripts/seed-all-onepiece.ts` |
| `generate-onepiece-images.ts` | Générer bannières avec IA | `npx tsx scripts/generate-onepiece-images.ts --dry-run` |

**Données :**
- Source : https://www.opecards.fr
- Bucket : `onepiece-cards`

### Lorcana

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-lorcana.ts` | Seed une série | `npx tsx scripts/seed-lorcana.ts FirstChapter` |
| `seed-all-lorcana.ts` | Seed toutes les séries | `npx tsx scripts/seed-all-lorcana.ts` |

**Données :**
- Source FR : https://www.lorcards.fr
- Source EN : https://dreamborn.ink
- Source JP : https://www.takaratomy.co.jp/products/disneylorcana/
- Bucket : `lorcana-cards`

### Riftbound

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-riftbound.ts` | Seed données Riftbound | `npx tsx scripts/seed-riftbound.ts` |

### Naruto Kayou

| Script | Description | Usage |
|--------|-------------|-------|
| `seed-naruto.ts` | Seed données Naruto | `npx tsx scripts/seed-naruto.ts` |

## Scripts Utilitaires

### Analyse Globale

| Script | Description |
|--------|-------------|
| `analyze-all-images.ts` | Analyse images manquantes pour tous les TCGs |

Usage :
```bash
npx tsx scripts/analyze-all-images.ts
```

Génère un rapport dans `scripts/logs/all-images-analysis.json` avec :
- Total cartes par TCG
- Total images par TCG
- Pourcentage de couverture
- Cartes sans images

## Génération d'Images IA (Higgsfield)

Les scripts suivants utilisent l'API Higgsfield Cloud pour générer des bannières de séries (16:9, 1K).

### Configuration

Variables d'environnement requises dans `.env.local` :
```env
HF_API_KEY=your_api_key
HF_SECRET=your_secret
```

### Scripts

| Script | TCG | Prompts |
|--------|-----|---------|
| `generate-pokemon-images.ts` | Pokemon | `scripts/data/pokemon-set-prompts.ts` |
| `generate-onepiece-images.ts` | One Piece | `scripts/data/onepiece-set-prompts.ts` |

### Options

- `--dry-run` : Afficher les prompts sans appeler l'API
- `--start=N` : Reprendre à partir de l'index N
- `--count=N` : Générer N images seulement

### Coût

- ~3 crédits par image
- $1 = 16 crédits
- Prix estimé : ~$0.19 par image

### Exemples

```bash
# Prévisualiser les prompts
npx tsx scripts/generate-pokemon-images.ts --dry-run

# Générer toutes les images Pokemon
npx tsx scripts/generate-pokemon-images.ts

# Reprendre depuis l'index 50
npx tsx scripts/generate-pokemon-images.ts --start=50

# Générer 5 images One Piece à partir de l'index 10
npx tsx scripts/generate-onepiece-images.ts --start=10 --count=5
```

### Output

Images générées dans :
- `scripts/output/pokemon-images/`
- `scripts/output/onepiece-images/`

Progression sauvegardée dans :
- `scripts/output/pokemon-images-progress.json`
- `scripts/output/onepiece-images-progress.json`

## Fichiers de Progression

Les scripts sauvegardent leur progression dans `scripts/logs/` :

| Fichier | Description |
|---------|-------------|
| `pokemon-download-progress.json` | Progression téléchargement Pokemon |
| `starwars-download-progress.json` | Progression téléchargement Star Wars |
| `pokemon-images-analysis.json` | Rapport analyse Pokemon |
| `starwars-images-analysis.json` | Rapport analyse Star Wars |
| `all-images-analysis.json` | Rapport analyse globale |

**Note :** Ces fichiers permettent de reprendre un script interrompu. Ils sont automatiquement supprimés à la fin d'un script réussi.

## Best Practices

### 1. Toujours tester en dry-run d'abord

```bash
npx tsx scripts/download-missing-pokemon-images.ts --dry-run --limit=10
```

### 2. Utiliser --limit pour tester

```bash
npx tsx scripts/download-missing-starwars-images.ts --limit=20
```

### 3. Analyser avant de télécharger

```bash
# D'abord analyser
npx tsx scripts/analyze-pokemon-images.ts

# Ensuite télécharger
npx tsx scripts/download-missing-pokemon-images.ts
```

### 4. Vérifier les logs

Les logs sont sauvegardés dans `scripts/logs/`. Toujours vérifier les erreurs :

```bash
cat scripts/logs/pokemon-images-analysis.json | jq '.summary'
```

### 5. Reprendre après interruption

Les scripts sauvegardent leur progression automatiquement. Relancez simplement la même commande pour reprendre.

## Développement

### Ajouter un nouveau script

1. Créer le fichier dans `scripts/`
2. Utiliser les utilitaires de `scripts/lib/` :
   ```typescript
   import { createAdminClient } from './lib/supabase'
   import { logger } from './lib/logger'
   import { delay } from './lib/utils'
   ```
3. Suivre le pattern des scripts existants
4. Documenter dans ce README

### Conventions

- **Logging** : Utiliser `logger` de `scripts/lib/logger.ts`
- **Delays** : Utiliser `DELAYS` de `lib/constants/app-config.ts`
- **Images** : Toujours optimiser avec Sharp (480x672, WebP 85%)
- **Progression** : Sauvegarder dans `scripts/logs/{script}-progress.json`
- **Dry-run** : Toujours supporter l'option `--dry-run`

## Troubleshooting

### "Environment variables missing"

Assurez-vous que `.env.local` contient :
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

### "Bucket not found"

Créez le bucket dans Supabase :
```typescript
import { createPokemonBucket } from '../lib/supabase/storage'
await createPokemonBucket()
```

### "Rate limit exceeded"

Augmentez les délais dans le script ou utilisez `--limit` pour réduire la charge.

### Script bloqué

1. Vérifiez les logs dans `scripts/logs/`
2. Interrompre avec Ctrl+C
3. Relancer - la progression sera reprise automatiquement

## Support

Pour toute question sur les scripts, consultez :
- `CLAUDE.md` (documentation complète du projet)
- Code source des scripts dans `scripts/`
- Logs dans `scripts/logs/`
