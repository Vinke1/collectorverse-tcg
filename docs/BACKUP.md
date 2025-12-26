# Guide de Backup - CollectorVerse TCG

Ce document décrit les procédures de sauvegarde complète du projet.

## Vue d'ensemble

Le projet nécessite 3 types de backup :

| Type | Contenu | Méthode |
|------|---------|---------|
| **Code source** | Fichiers du projet | Git + GitHub |
| **Base de données** | Tables Supabase (PostgreSQL) | Script `backup-supabase.ts` |
| **Storage** | Images des cartes (Supabase Storage) | Script `backup-supabase.ts` |

---

## 1. Backup du Code Source (Git + GitHub)

### Configuration actuelle

- **Remote** : `https://github.com/Vinke1/collectorverse-tcg.git`
- **Branche principale** : `main`

### Commandes de backup

```bash
# Vérifier le statut
git status

# Ajouter et committer les changements
git add .
git commit -m "Description des changements"

# Pousser vers GitHub
git push origin main
```

### Bonnes pratiques

- Committer régulièrement avec des messages descriptifs
- Ne jamais committer les fichiers sensibles (`.env.local`, clés API)
- Le fichier `.gitignore` exclut déjà : `node_modules/`, `.env.local`, `backups/`

---

## 2. Backup Supabase (Base de données + Storage)

### Script de backup complet

```bash
# Exécuter le backup complet (DB + Storage)
npx tsx scripts/backup-supabase.ts

# Backup base de données uniquement
npx tsx scripts/backup-supabase.ts --db-only

# Backup storage uniquement
npx tsx scripts/backup-supabase.ts --storage-only

# Backup avec buckets spécifiques
npx tsx scripts/backup-supabase.ts --buckets lorcana-cards,pokemon-cards

# Mode dry-run (prévisualisation)
npx tsx scripts/backup-supabase.ts --dry-run
```

### Structure des backups

```
backups/
└── 2025-12-08T12-35-46/
    ├── manifest.json          # Métadonnées du backup
    ├── database/
    │   ├── full-backup.json   # Toutes les tables (fichier unique)
    │   ├── tcg_games.json     # Export par table
    │   ├── series.json
    │   ├── cards.json
    │   └── ...
    └── storage/
        ├── lorcana-cards/
        │   ├── SET1/
        │   │   ├── fr/
        │   │   └── en/
        │   └── ...
        ├── pokemon-cards/
        ├── onepiece-cards/
        └── starwars-cards/
```

### Tables sauvegardées

| Table | Description |
|-------|-------------|
| `tcg_games` | Définitions des TCG (Pokemon, Lorcana, etc.) |
| `series` | Séries/extensions de cartes |
| `series_releases` | Dates de sortie par langue |
| `cards` | Cartes individuelles |
| `user_collections` | Collections des utilisateurs |
| `wishlists` | Listes de souhaits |
| `rarities` | Types de rareté |
| `domains` | Configuration des domaines |

### Buckets Storage

| Bucket | Contenu |
|--------|---------|
| `lorcana-cards` | Images cartes Disney Lorcana |
| `pokemon-cards` | Images cartes Pokémon |
| `onepiece-cards` | Images cartes One Piece |
| `starwars-cards` | Images cartes Star Wars |
| `riftbound-cards` | Images cartes Riftbound |

---

## 3. Restauration

### Restaurer la base de données

```bash
# Restaurer depuis un backup
npx tsx scripts/restore-supabase.ts --from backups/2025-12-08T12-35-46

# Restaurer uniquement certaines tables
npx tsx scripts/restore-supabase.ts --from backups/2025-12-08T12-35-46 --tables cards,series

# Mode dry-run
npx tsx scripts/restore-supabase.ts --from backups/2025-12-08T12-35-46 --dry-run
```

### Restaurer le storage

Les images peuvent être ré-uploadées manuellement ou via le script de restauration :

```bash
npx tsx scripts/restore-supabase.ts --from backups/2025-12-08T12-35-46 --storage-only
```

---

## 4. Planification des backups

### Fréquence recommandée

| Type | Fréquence | Raison |
|------|-----------|--------|
| Code (Git) | À chaque modification | Versionning continu |
| DB | Hebdomadaire ou avant migration | Données utilisateurs |
| Storage | Mensuel ou après ajout massif | Images volumineuses |

### Checklist avant déploiement

- [ ] `git push` effectué
- [ ] Backup DB récent (< 7 jours)
- [ ] Backup Storage si nouvelles images ajoutées

---

## 5. Espace disque

### Tailles actuelles (décembre 2025)

- **Base de données** : ~120,704 enregistrements (~50-100 MB JSON)
- **Storage complet** : ~116,286 images (~6 GB)
  - `pokemon-cards` : 100,405 fichiers (5.4 GB)
  - `lorcana-cards` : 5,905 fichiers (269 MB)
  - `onepiece-cards` : 5,690 fichiers (275 MB)
  - `starwars-cards` : 3,041 fichiers (89 MB)
  - `riftbound-cards` : 1,245 fichiers (66 MB)

### Nettoyage des anciens backups

Conserver les 3-5 derniers backups. Supprimer manuellement les anciens :

```bash
# Lister les backups
ls -la backups/

# Supprimer un ancien backup
rm -rf backups/2025-12-03/
```

---

## 6. Variables d'environnement requises

Le script de backup nécessite ces variables dans `.env.local` :

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxxx  # Requis pour backup complet
```

---

## Historique des backups

| Date | Type | Enregistrements | Images | Notes |
|------|------|-----------------|--------|-------|
| 2025-12-26 | Dry-run | 120,704 | 116,286 | Validation du nouveau script |
| 2025-12-08 | Complet | 6,675 | 6,495 | Lorcana + Riftbound uniquement |
| 2025-12-04 | Complet | - | - | - |
| 2025-12-03 | Complet | - | - | Premier backup |
