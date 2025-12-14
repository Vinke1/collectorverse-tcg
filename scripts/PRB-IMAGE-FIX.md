# PRB Images Fix - 14 Décembre 2024

## Problème Identifié

Les cartes des séries PRB01 et PRB02 de One Piece n'affichaient pas leurs images sur le site. Seule la première carte (Sanji PRB01-001-L) était visible.

### Analyse

1. **Base de données** : 737 cartes PRB (245 EN + 176 FR pour PRB01, 158 EN + 158 FR pour PRB02)
2. **Storage Supabase** : 327 images uploadées partiellement (99 EN + 53 FR pour PRB01, 100 EN + 75 FR pour PRB02)
3. **URLs dans la DB** : TOUTES pointaient vers `static.opecards.fr` au lieu du storage Supabase

### Cause Racine

Le script `scripts/seed-prb-series.ts` construisait les URLs d'images manuellement en se basant sur le slug de l'URL de la page, mais cette construction était incorrecte :

**URL construite (incorrecte)** :
```
https://static.opecards.fr/cards/en/op01/image-cartes-a-collectionner-one-piece-card-game-tcg-opecards-en-op01-006-uc-prb01-full-art-otama.webp
```

**URL réelle (correcte)** :
```
https://static.opecards.fr/cards/en/prb01/image-trading-cards-one-piece-card-game-tcg-opecards-en-op01-006-uc-prb01-full-art-otama.webp
```

**Différences** :
1. Dossier : `/prb01/` au lieu de `/op01/` (le dossier est la série PRB, pas la série de la carte)
2. Préfixe EN : `image-trading-cards` au lieu de `image-cartes-a-collectionner`

Le script insérait les cartes avec ces URLs invalides, et même si certaines images étaient téléchargées, les `image_url` n'étaient jamais mises à jour dans la DB.

## Solution Implémentée

### 1. Script de Téléchargement Corrigé

Créé `scripts/download-prb-images.ts` qui :

1. **Récupère** toutes les cartes avec URLs `static.opecards.fr` depuis la DB
2. **Scrape** la vraie URL d'image depuis la page source (stockée dans `attributes.source_url`)
3. **Télécharge** l'image via Puppeteer (`page.goto()`)
4. **Optimise** avec Sharp (480x672 WebP 85%)
5. **Upload** vers Supabase Storage (`onepiece-cards/{SERIES}/{lang}/{number}.webp`)
6. **Met à jour** `image_url` dans la DB avec l'URL Supabase

### 2. Correction du Script de Scraping

Modifié `scripts/seed-prb-series.ts` (ligne 158) :
- Avant : `const imagePrefix = lang === 'en' ? 'image-trading-cards' : 'image-cartes-a-collectionner'`
- Après : `const imagePrefix = 'image-cartes-a-collectionner'` (toujours le même préfixe)
- Note : Cette correction est incomplète car le dossier est toujours incorrect. Le mieux est de scraper les pages.

**Recommandation** : Pour les futurs scraping PRB, utiliser le script de téléchargement qui scrape les vraies URLs au lieu de les construire.

## Résultats

### Avant
- 0 images affichées (sauf Sanji)
- 737 cartes avec URLs invalides
- 327 images uploadées mais non référencées

### Après (en cours)
- Téléchargement automatique de 737 images
- URLs Supabase correctes dans la DB
- Estimé : ~1h45 pour compléter

### Statistiques (14 Dec 2024 - 15:35)
```
PRB01:
  EN: 35/245 (14%) - 210 restantes
  FR: 0/176 (0%) - 176 restantes

PRB02:
  EN: 0/158 (0%) - 158 restantes
  FR: 0/158 (0%) - 158 restantes
```

## Scripts Créés

1. **`scripts/download-prb-images.ts`** - Télécharge et corrige toutes les images PRB
   ```bash
   # Télécharger toutes les images
   npx tsx scripts/download-prb-images.ts --series all --lang all

   # Télécharger une série spécifique
   npx tsx scripts/download-prb-images.ts --series PRB01 --lang en

   # Dry-run
   npx tsx scripts/download-prb-images.ts --dry-run

   # Limiter le nombre
   npx tsx scripts/download-prb-images.ts --limit 50
   ```

2. **`scripts/check-prb-cards.ts`** - Analyse l'état des cartes PRB dans la DB et storage

3. **`scripts/check-prb-progress.ts`** - Vérifie l'avancement du téléchargement
   ```bash
   npx tsx scripts/check-prb-progress.ts
   ```

4. **`scripts/test-prb-url.ts`** - Test pour extraire une URL réelle (debug)

## Leçons Apprises

1. **Ne jamais construire les URLs manuellement** - Toujours scraper les vraies URLs depuis les pages
2. **Vérifier les uploads** - S'assurer que les images uploadées sont bien référencées dans la DB
3. **Tester avec quelques cartes** - Avant de lancer un scraping complet, tester avec `--limit 5`
4. **Stocker les URLs sources** - Le champ `attributes.source_url` est crucial pour re-scraper

## Commandes Utiles

```bash
# Vérifier l'avancement toutes les 5 minutes
while true; do npx tsx scripts/check-prb-progress.ts; sleep 300; done

# Relancer si besoin (reprend automatiquement car filtre sur static.opecards.fr)
npx tsx scripts/download-prb-images.ts --series all --lang all
```

## TODO Futur

- [ ] Appliquer la même logique aux autres séries One Piece si nécessaire
- [ ] Ajouter un script de vérification automatique des URLs invalides
- [ ] Améliorer `seed-prb-series.ts` pour scraper les URLs au lieu de les construire
