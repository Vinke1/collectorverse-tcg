# Script de Copie d'Images Pokemon EN vers Autres Langues

Ce script permet de copier automatiquement les images Pokemon EN vers les autres langues (DE, FR, IT, ES, PT) lorsque l'image manque dans la langue cible.

## Principe

Le script identifie les cartes qui :
1. N'ont pas d'`image_url` dans la langue cible
2. Ont une `image_url` valide dans la version EN (même série + même numéro)

Il copie ensuite l'image EN vers la langue cible dans Supabase Storage et met à jour la base de données.

## Utilisation

### Mode Dry-Run (recommandé en premier)

Affiche ce qui serait copié sans effectuer de modifications :

```bash
npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run
```

### Copie Complète

Copie toutes les images manquantes :

```bash
npx tsx scripts/copy-pokemon-images-from-en.ts
```

### Options

#### Série Spécifique

```bash
npx tsx scripts/copy-pokemon-images-from-en.ts --series dp6
npx tsx scripts/copy-pokemon-images-from-en.ts --series smp --dry-run
```

#### Langue Spécifique

Copie uniquement pour une langue cible (de, fr, it, es, pt) :

```bash
npx tsx scripts/copy-pokemon-images-from-en.ts --lang fr
npx tsx scripts/copy-pokemon-images-from-en.ts --lang de --dry-run
```

#### Limiter le Nombre de Copies

Utile pour tester :

```bash
npx tsx scripts/copy-pokemon-images-from-en.ts --limit 50
npx tsx scripts/copy-pokemon-images-from-en.ts --series dp6 --lang fr --limit 10
```

#### Combinaisons

```bash
# Tester 10 copies pour la série dp6 en français
npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run --series dp6 --lang fr --limit 10

# Copier toutes les images manquantes en allemand pour la série smp
npx tsx scripts/copy-pokemon-images-from-en.ts --series smp --lang de
```

## Progression & Reprise

Le script sauvegarde automatiquement la progression dans :
```
scripts/logs/pokemon-copy-progress.json
```

En cas d'interruption, relancez simplement le même script - il reprendra là où il s'était arrêté.

Le fichier de progression est automatiquement supprimé une fois toutes les tâches terminées avec succès.

## Statistiques

D'après l'analyse des images manquantes (voir `scripts/analyze-image-reuse.ts`) :

- **6600+ images** peuvent être copiées depuis EN
- Séries avec le plus d'images à copier :
  - `smp` : 699 images
  - `swshp` : 468 images
  - `dp6` : 292 images
  - `dp3` : 264 images
  - `dp2` : 248 images

## Exemples de Résultats

### Dry-Run
```
================================================================================
Copie d'images Pokemon EN -> Autres langues
================================================================================

Options:
  Série:  dp6
  Langue: fr
  Limite: 5

...

📊 [1/5] dp6/fr/1
ℹ️  [DRY-RUN] Copie: dp6/en/1.webp -> dp6/fr/1.webp
📊 [2/5] dp6/fr/10
ℹ️  [DRY-RUN] Copie: dp6/en/10.webp -> dp6/fr/10.webp
...

================================================================================
Résumé
================================================================================

Images copiées:      5
BDD mise à jour:     0
Échecs:              0
Restantes:           141
```

### Copie Réelle
```
✅ dp6/fr/1 - Image copiée et BDD mise à jour
✅ dp6/fr/10 - Image copiée et BDD mise à jour
✅ dp6/fr/100 - Image copiée et BDD mise à jour
...

================================================================================
Résumé
================================================================================

Images copiées:      146
BDD mise à jour:     146
Échecs:              0
Restantes:           0

✅ Toutes les images ont été copiées avec succès
```

## Structure de Stockage

Les images sont copiées dans Supabase Storage :

```
pokemon-cards/
├── dp6/
│   ├── en/
│   │   ├── 1.webp (source)
│   │   ├── 10.webp
│   │   └── ...
│   ├── fr/
│   │   ├── 1.webp (copié depuis en)
│   │   ├── 10.webp
│   │   └── ...
│   └── de/
│       ├── 1.webp (copié depuis en)
│       └── ...
```

## Avertissements

- **Délai entre copies** : 100ms entre chaque opération pour ne pas surcharger Supabase
- **Pagination** : Le script gère automatiquement la pagination (batchs de 1000 cartes)
- **Validation** : Seules les cartes EN avec image valide sont utilisées comme source
- **Progression** : Sauvegardée tous les 10 copies pour éviter de perdre le travail en cas d'interruption

## Dépannage

### Erreur "Série XXX introuvable"

Les codes de séries doivent être en lowercase. Utilisez par exemple `dp6` et non `DP6`.

Pour voir la liste des séries disponibles :
```bash
npx tsx scripts/analyze-image-reuse.ts
```

### Erreur "Langue invalide"

Langues supportées : `de`, `fr`, `it`, `es`, `pt`

### Échecs de copie

Si des copies échouent, vérifiez :
- Que l'image source existe bien dans Supabase Storage
- Que les permissions Supabase sont correctes (SERVICE_ROLE_KEY requis)
- Les logs d'erreur affichés

## Workflow Recommandé

1. **Analyser** ce qui peut être copié :
   ```bash
   npx tsx scripts/analyze-image-reuse.ts
   ```

2. **Tester** avec dry-run et limite :
   ```bash
   npx tsx scripts/copy-pokemon-images-from-en.ts --dry-run --limit 10
   ```

3. **Copier** une série spécifique :
   ```bash
   npx tsx scripts/copy-pokemon-images-from-en.ts --series dp6
   ```

4. **Copier** toutes les images manquantes :
   ```bash
   npx tsx scripts/copy-pokemon-images-from-en.ts
   ```

5. **Vérifier** les résultats dans l'application ou la base de données
