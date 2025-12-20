# One Piece Promo Cards - Scraping & Data Structure

Ce document explique comment les cartes promo One Piece (FR et EN) ont été récupérées et structurées depuis opecards.fr.

## Sources de données

### URLs de recherche

| Langue | URL | Série ID | Pages |
|--------|-----|----------|-------|
| FR | https://www.opecards.fr/cards/search?sortBy=number&serie=479&language=FR | 479 | 3 |
| EN | https://www.opecards.fr/cards/search?sortBy=number&serie=187&language=EN | 187 | 4 |

### Comment trouver l'ID de série

1. Aller sur https://www.opecards.fr/series
2. Cliquer sur la série voulue
3. Dans la page de la série, observer l'URL de recherche ou inspecter le HTML
4. L'ID de série est dans le paramètre `serie=XXX`

---

## Formats d'URLs des cartes

opecards.fr utilise **deux formats d'URL principaux** pour les cartes promo :

### Format 1 : Cartes avec code P-XXX

```
/cards/p-{number}-p-{description}-{name}
```

**Exemples :**
- `/cards/p-008-p-dash-pack-volume-2-yamato` → P-008
- `/cards/p-045-p-version-2-roronoa-zoro` → P-045 (V2)
- `/cards/p-084-p-evenement-de-sortie-op10-winner-baggy` → P-084 (Winner)

**Regex de parsing :**
```typescript
const pMatch = slug.match(/^p-(\d{3})-p-(.+)$/i)
// pMatch[1] = numéro (ex: "008")
// pMatch[2] = reste du slug (ex: "dash-pack-volume-2-yamato")
```

### Format 2 : Cartes avec code série (ST, OP, EB)

```
/cards/{prefix}{set}-{number}-{rarity}-{description}-{name}
```

**Exemples :**
- `/cards/st19-003-sr-pack-promotionnel-vol-0-tashigi` → ST19-003
- `/cards/op09-002-r-fete-decks-debutants-st23-st28-uta` → OP09-002
- `/cards/eb01-027-r-fete-decks-debutants-st23-st28-mr1-das-bones` → EB01-027
- `/cards/st19-003-sr-pack-promotionnel-vol-0-full-art-tashigi` → ST19-003 (Full Art)

**Regex de parsing :**
```typescript
const setMatch = slug.match(/^([a-z]+)(\d+)-(\d{3})-([a-z]+)-(.+)$/i)
// setMatch[1] = prefix (ex: "st", "op", "eb")
// setMatch[2] = numéro de set (ex: "19", "09", "01")
// setMatch[3] = numéro de carte (ex: "003", "002", "027")
// setMatch[4] = rareté (ex: "sr", "r", "c", "uc")
// setMatch[5] = reste du slug
```

---

## Structure du Numbering

### Numbering de stockage (colonne `number` en DB)

Le numbering stocké dans la base de données suit ces règles :

| Type de carte | Format stocké | Exemple |
|---------------|---------------|---------|
| Carte P standard | `XXX` | `008`, `045`, `084` |
| Carte P Version 2 | `XXX-V2` | `045-V2` |
| Carte P Winner | `XXX-W` | `084-W` |
| Carte P Full Art | `XXX-FA` | (rare pour P) |
| Carte ST/OP/EB standard | `STXX-XXX` | `ST19-003`, `OP09-002` |
| Carte ST/OP/EB Full Art | `STXX-XXX-FA` | `ST19-003-FA` |
| Carte ST/OP/EB Winner | `STXX-XXX-W` | `OP09-002-W` |
| Carte ST/OP/EB Version 2 | `STXX-XXX-V2` | `ST06-006-V2` |

### Numbering d'affichage (attribut `display_number`)

Le numbering d'affichage est plus simple :

| Type | Display Number |
|------|----------------|
| Carte P | `P-XXX` (ex: `P-008`) |
| Carte ST | `STXX-XXX` (ex: `ST19-003`) |
| Carte OP | `OPXX-XXX` (ex: `OP09-002`) |
| Carte EB | `EBXX-XXX` (ex: `EB01-027`) |

---

## Détection des variantes

Les variantes sont détectées dans le slug de l'URL :

```typescript
const isVersion2 = namePart.includes('version-2')
const isFullArt = namePart.includes('full-art')
const isWinner = namePart.includes('winner')
```

### Suffixes ajoutés au numéro de stockage

| Variante | Suffixe | Priorité |
|----------|---------|----------|
| Version 2 | `-V2` | 1 (prioritaire) |
| Full Art | `-FA` | 2 |
| Winner | `-W` | 3 |

**Note :** Un seul suffixe est appliqué, dans l'ordre de priorité.

---

## Récupération des images

### Méthode 1 : JSON-LD (prioritaire)

La page de détail de chaque carte contient un script JSON-LD avec les images :

```html
<script type="application/ld+json">
{
  "@type": "Product",
  "image": [
    "https://static.opecards.fr/cards/fr/p/image-...-p-008-p-dash-pack-volume-2-yamato.webp",
    "https://static.opecards.fr/cards/en/p/image-...-p-008-p-dash-pack-volume-2-yamato.webp"
  ]
}
</script>
```

**Code d'extraction :**
```typescript
const jsonLdScript = document.querySelector('script[type="application/ld+json"]')
const jsonLd = JSON.parse(jsonLdScript.textContent)
const images = Array.isArray(jsonLd.image) ? jsonLd.image : [jsonLd.image]
// Filtrer par langue
const frImage = images.find(img => img.includes('/fr/'))
const enImage = images.find(img => img.includes('/en/'))
```

### Méthode 2 : og:image (fallback)

```typescript
const ogImage = document.querySelector('meta[property="og:image"]')
const imageUrl = ogImage?.content
```

### Structure des URLs d'images

```
https://static.opecards.fr/cards/{lang}/{series}/image-{type}-one-piece-card-game-tcg-opecards-{slug}.webp
```

**Composants :**
- `{lang}` : `fr`, `en`, `jp`
- `{series}` : `p`, `op01`, `st19`, etc.
- `{type}` : `cartes-a-collectionner` (FR) ou `trading-cards` (EN)
- `{slug}` : slug complet de la carte

---

## Stockage des images (Supabase)

### Structure de dossiers

```
onepiece-cards/
└── P/
    ├── fr/
    │   ├── 008.webp
    │   ├── 045.webp
    │   ├── 045-V2.webp
    │   ├── 084.webp
    │   ├── 084-W.webp
    │   ├── ST19-003.webp
    │   ├── ST19-003-FA.webp
    │   ├── OP09-002.webp
    │   └── ...
    └── en/
        ├── 001.webp
        ├── 001-V2.webp
        ├── 001-W.webp
        ├── ST13-001.webp
        └── ...
```

### Optimisation des images

Toutes les images sont optimisées avec Sharp avant upload :

```typescript
sharp(buffer)
  .resize(480, 672, { fit: 'inside', withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer()
```

---

## Nettoyage des noms

Les noms sont extraits du slug et nettoyés :

### Préfixes à supprimer

```typescript
namePart
  .replace(/^version-2-/, '')
  .replace(/^full-art-/, '')
  .replace(/^winner-/, '')
  .replace(/^pack-promotionnel-vol-\d+-/, '')
  .replace(/^dash-pack-volume-\d+-/, '')
  .replace(/^fete-decks-debutants-st\d+-st\d+-/, '')
  .replace(/^evenement-de-sortie-op\d+-/, '')
  .replace(/^festival-de-jeu-cannes-/, '')
  .replace(/^pack-devenement-de-sortie-st\d+-st\d+-/, '')
```

### Corrections de noms courants

```typescript
cleanName
  .replace(/Monkeydluffy/gi, 'Monkey D. Luffy')
  .replace(/Trafalgarlaw/gi, 'Trafalgar Law')
  .replace(/Portgas D Ace/gi, 'Portgas D. Ace')
  .replace(/Mr1 Das Bones/gi, 'Mr.1 (Das Bones)')
```

### Indicateurs de variante dans le nom

```typescript
if (isFullArt) displayName += ' (Full Art)'
if (isWinner) displayName += ' (Winner)'
if (isVersion2) displayName += ' (V2)'
```

---

## Résultat final

### Cartes FR (série P)

| Avant | Après |
|-------|-------|
| 32 cartes | 61 cartes |
| Numbering: 001-032 | Numbering: 008, 009, 023, ..., OP03-116, ST19-003, etc. |
| Noms simplifiés | Noms complets avec source (Pack Promotionnel Vol.0, etc.) |

### Cartes EN (série P)

| Avant | Après |
|-------|-------|
| 24 cartes | 116 cartes |
| Numbering: 001-024 | Numbering: 001, 001-V2, 001-W, ..., ST13-001, OP05-036, etc. |

---

## Scripts disponibles

```bash
# Re-seeder les promos FR
npx tsx scripts/reseed-onepiece-promo-fr.ts

# Re-seeder les promos EN
npx tsx scripts/reseed-onepiece-promo-en.ts

# Mode dry-run (preview sans modification)
npx tsx scripts/reseed-onepiece-promo-fr.ts --dry-run --skip-images
```

---

## Vérification d'autres séries

Pour appliquer cette méthode à d'autres séries :

1. **Trouver l'ID de série** sur opecards.fr
2. **Compter le nombre de pages** de résultats
3. **Adapter le script** :
   - Modifier `PROMO_SEARCH_URL` avec le bon `serie=XXX`
   - Modifier le nombre de pages dans la boucle
   - Adapter le parsing des URLs si le format diffère
4. **Exécuter en dry-run** d'abord pour vérifier
5. **Exécuter en production**

### Checklist de vérification

- [ ] Nombre de cartes correspond à opecards.fr
- [ ] Numbering correct (pas de doublons, pas de gaps inexpliqués)
- [ ] Variantes détectées (Full Art, Winner, V2)
- [ ] Images téléchargées et optimisées
- [ ] Noms corrects et propres
