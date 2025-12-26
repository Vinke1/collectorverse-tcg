# Configuration SEO - CollectorVerse

Ce guide explique comment configurer les outils SEO pour CollectorVerse.

## 1. Google Analytics 4 (GA4)

### Etape 1 : Creer une propriete GA4

1. Aller sur [Google Analytics](https://analytics.google.com)
2. Cliquer sur **Admin** (icone engrenage en bas a gauche)
3. Cliquer sur **Creer une propriete**
4. Nom : `CollectorVerse`
5. Fuseau horaire : Europe/Paris
6. Devise : EUR
7. Cliquer sur **Suivant** et completer les infos business

### Etape 2 : Configurer le flux de donnees

1. Dans la nouvelle propriete, aller dans **Flux de donnees**
2. Cliquer sur **Ajouter un flux** > **Web**
3. URL du site : `https://collectorverse.io`
4. Nom du flux : `CollectorVerse Web`
5. Cliquer sur **Creer le flux**
6. **Copier le Measurement ID** (format : `G-XXXXXXXXXX`)

### Etape 3 : Ajouter l'ID dans l'app

Ajouter dans `.env.local` (et `.env.production`) :

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Redéployer l'app pour appliquer.

### Verification

- En production, ouvrir la console du navigateur
- Chercher les requetes vers `googletagmanager.com`
- Dans GA4, aller dans **Temps reel** pour voir les visiteurs actifs

---

## 2. Google Search Console

### Etape 1 : Ajouter la propriete

1. Aller sur [Google Search Console](https://search.google.com/search-console)
2. Cliquer sur **Ajouter une propriete**
3. Choisir **Propriete de domaine** ou **Prefixe d'URL**
   - Recommande : Prefixe d'URL `https://collectorverse.io`
4. Verifier la propriete

### Etape 2 : Methodes de verification

**Option A - Balise HTML (recommandee)** :

Ajouter dans `app/layout.tsx` dans les metadata :

```tsx
export const metadata: Metadata = {
  // ... existing metadata
  verification: {
    google: 'VOTRE_CODE_VERIFICATION',
  },
};
```

**Option B - Fichier HTML** :

1. Telecharger le fichier de verification depuis Search Console
2. Le placer dans `/public/`
3. Verifier qu'il est accessible via `https://collectorverse.io/googleXXXXXXXX.html`

### Etape 3 : Soumettre le sitemap

1. Dans Search Console, aller dans **Sitemaps**
2. Ajouter l'URL : `https://collectorverse.io/sitemap.xml`
3. Cliquer sur **Envoyer**

### Etape 4 : Verifier l'indexation

Apres 24-48h :
1. Aller dans **Pages** pour voir le statut d'indexation
2. Utiliser **Inspection d'URL** pour tester des pages specifiques
3. Verifier **Experience** pour Core Web Vitals

---

## 3. Fichiers SEO generes automatiquement

### sitemap.xml

- **URL** : `https://collectorverse.io/sitemap.xml`
- **Genere par** : `app/sitemap.ts`
- **Contenu** :
  - Page d'accueil (priorite 1.0)
  - Pages TCG `/series/{tcg}` (priorite 0.9)
  - Pages series `/series/{tcg}/{code}` (priorite 0.8)
  - Pages legales (priorite 0.3)

### robots.txt

- **URL** : `https://collectorverse.io/robots.txt`
- **Genere par** : `app/robots.ts`
- **Autorise** : Toutes les pages publiques
- **Bloque** : `/api/`, `/auth/`, `/login`, `/share/`, `/_next/`

---

## 4. Checklist SEO

### Configuration initiale

- [ ] GA4 Measurement ID configure dans `.env`
- [ ] Google Search Console verifie
- [ ] Sitemap soumis
- [ ] robots.txt accessible

### Verification post-deploiement

- [ ] `https://collectorverse.io/sitemap.xml` retourne le XML
- [ ] `https://collectorverse.io/robots.txt` retourne les regles
- [ ] GA4 Temps reel montre des visiteurs
- [ ] Search Console ne montre pas d'erreurs

### Optimisations futures

- [ ] Ajouter Schema.org markup (JSON-LD)
- [ ] Creer pages landing par TCG (`/pokemon`, `/lorcana`)
- [ ] Optimiser les images (deja fait avec WebP)
- [ ] Ajouter canonical URLs
- [ ] Configurer hreflang pour multi-langue

---

## 5. Commandes utiles

```bash
# Verifier le build
npm run build

# Tester sitemap en local
curl http://localhost:3000/sitemap.xml

# Tester robots.txt en local
curl http://localhost:3000/robots.txt
```

---

## 6. Ressources

- [Next.js SEO Documentation](https://nextjs.org/docs/app/api-reference/file-conventions/metadata)
- [Google Analytics 4 Setup](https://support.google.com/analytics/answer/9304153)
- [Search Console Help](https://support.google.com/webmasters/answer/9128668)
- [Schema.org](https://schema.org/)
