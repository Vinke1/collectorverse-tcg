# Guide de Lancement Marketing - CollectorVerse TCG

> **Derniere mise a jour** : Decembre 2024
> **Statut** : Pre-lancement
> **Budget pub** : 0€

Ce guide operationnel accompagne la strategie [GO-TO-MARKET.md](./GO-TO-MARKET.md) avec un focus sur l'execution et le suivi des taches.

---

## Table des matieres

1. [Tableau de bord Marketing](#tableau-de-bord-marketing)
2. [Phase 1 : Preparation technique](#phase-1--preparation-technique)
3. [Phase 2 : Lancement Soft](#phase-2--lancement-soft)
4. [Phase 3 : Croissance](#phase-3--croissance)
5. [Assets et visuels](#assets-et-visuels)
6. [Automatisation](#automatisation)
7. [FAQ et decisions](#faq-et-decisions)

---

## Tableau de bord Marketing

### Statut des elements cles

| Element                      | Status        | Priorite   | Notes |
|------------------------------|---------------|------------|-------|
| Visuels/assets marketing     | A verifier    | Haute      | Banniere Twitter, screenshots app |
| Posts Reddit (participation) | A verifier    | Haute      | Compte avec karma requis |
| Contenu Twitter regulier     | A verifier    | Haute      | Compte cree ? |
| Contenu TikTok/Reels         | A verifier    | Haute      | Compte cree ? |
| Product Hunt listing         | Non fait      | Moyenne    | Attendre traction initiale |
| BetaList listing             | Non fait      | Moyenne    | Soumettre pendant Phase 2 |
| Contact influenceurs         | Non fait      | Moyenne    | Commencer semaine 3 |

### Statut technique (prerequis)

| Element | Status | Doc |
|---------|--------|-----|
| sitemap.xml | Fait | [SEO-SETUP.md](./SEO-SETUP.md) |
| robots.txt | Fait | [SEO-SETUP.md](./SEO-SETUP.md) |
| Google Analytics 4 | A configurer | [SEO-SETUP.md](./SEO-SETUP.md) |
| Google Search Console | A configurer | [SEO-SETUP.md](./SEO-SETUP.md) |
| PWA installable | Fait | - |
| Open Graph meta tags | A verifier | - |

---

## Phase 1 : Preparation technique

**Duree estimee** : 3-4 jours
**Objectif** : Tout mettre en place avant de communiquer

### Jour 1-2 : SEO Foundation

```
[ ] 1. Configurer Google Analytics 4
    - Creer propriete GA4
    - Recuperer Measurement ID (G-XXXXXXXXXX)
    - Ajouter dans .env.local : NEXT_PUBLIC_GA_MEASUREMENT_ID=
    - Redeployer
    - Verifier dans GA4 > Temps reel

[ ] 2. Configurer Google Search Console
    - Ajouter propriete : https://collectorverse.io
    - Verifier via balise HTML ou fichier
    - Soumettre sitemap.xml

[ ] 3. Verifier les fichiers SEO
    - Tester https://collectorverse.io/sitemap.xml
    - Tester https://collectorverse.io/robots.txt
    - Verifier Open Graph avec https://developers.facebook.com/tools/debug/
```

**Reference detaillee** : [SEO-SETUP.md](./SEO-SETUP.md)

### Jour 3-4 : Assets marketing

#### Visuels a creer

| Asset | Dimensions | Usage | Outil suggere |
|-------|------------|-------|---------------|
| Banniere Twitter/X | 1500x500 px | Profil Twitter | Canva |
| Banniere LinkedIn | 1584x396 px | Profil LinkedIn | Canva |
| Carre Instagram/TikTok | 1080x1080 px | Posts | Canva |
| Story/Reel cover | 1080x1920 px | Stories | Canva |
| Screenshots app | 1280x720 px | Presentations | OBS/Screenshot |
| Favicon/Logo | 512x512 px | Partout | Figma |

#### Screenshots necessaires

```
[ ] 1. Page d'accueil avec selection TCG
[ ] 2. Liste des series Pokemon
[ ] 3. Vue d'une serie avec progression
[ ] 4. Grille de cartes
[ ] 5. Vue mobile (PWA)
```

#### Video demo (optionnel mais recommande)

```
[ ] Enregistrer video demo 30-60 secondes :
    - Montrer la selection TCG
    - Parcourir une serie
    - Ajouter quelques cartes
    - Montrer la progression

Outils : OBS Studio (capture) + CapCut (montage)
```

---

## Phase 2 : Lancement Soft

**Duree** : 1 semaine
**Objectif** : Premiers utilisateurs et feedback

### Calendrier type

| Jour | Action principale | Action secondaire |
|------|-------------------|-------------------|
| Lundi | Post Twitter annonce + epingler | Setup profil complet |
| Mardi | Premier TikTok/Reel (demo rapide) | Engagement Twitter |
| Mercredi | Post Reddit r/pokemoncardcollectors | Repondre commentaires |
| Jeudi | Story Instagram + post carre | Engagement Reddit |
| Vendredi | Post Reddit r/Lorcana | Engagement TikTok |
| Weekend | Engagement + partage Discord | Analyse metriques |

### Checklist Lundi - Twitter Launch

```
[ ] 1. Finaliser profil Twitter
    - Photo de profil (logo)
    - Banniere 1500x500
    - Bio optimisee (voir template ci-dessous)
    - Lien vers l'app

[ ] 2. Publier tweet d'annonce
    - Texte + 2-4 screenshots
    - Hashtags : #PokemonTCG #Lorcana #TCG
    - Epingler le tweet

[ ] 3. Follow comptes strategiques
    - Creaturs TCG
    - Comptes officiels
    - Boutiques de cartes
```

**Template bio Twitter** :
```
Gerez toutes vos collections TCG en un seul endroit
Pokemon • Lorcana • One Piece • Star Wars • Riftbound
Gratuit | Mobile & Desktop | Multi-langue
Beta ouverte
[lien]
```

### Checklist Mardi - TikTok/Reels

```
[ ] 1. Creer compte TikTok @collectorverse
    - Photo profil
    - Bio courte avec lien

[ ] 2. Publier premiere video
    - Format : Screen recording de l'app
    - Duree : 15-30 secondes
    - Son tendance
    - Texte a l'ecran
    - CTA : "Lien dans la bio"

Idees de videos :
- "POV : Tu trouves enfin une app pour toutes tes collections"
- "Ma collection Pokemon en 15 secondes"
- "Comment je track mes cartes Lorcana"
```

### Checklist Mercredi - Reddit Pokemon

```
[ ] 1. Verifier karma du compte (minimum recommande : 100+)

[ ] 2. Lire les regles de r/pokemoncardcollectors

[ ] 3. Publier post (voir template dans GO-TO-MARKET.md)
    - Titre accrocheur
    - Texte authentique (pas pub)
    - Pas de lien direct dans le post
    - Mentionner "lien dans mon profil"

[ ] 4. Repondre a TOUS les commentaires

[ ] 5. Ne pas reposter pendant 1 semaine sur ce sub
```

### Checklist Vendredi - Reddit Lorcana

```
[ ] 1. Adapter le message pour communaute Lorcana

[ ] 2. Publier sur r/Lorcana ou r/DisneyLorcana

[ ] 3. Engagement avec les commentaires
```

---

## Phase 3 : Croissance

**Duree** : Semaines 2-4
**Objectif** : Augmenter la visibilite et les inscriptions

### Rythme hebdomadaire recommande

| Activite | Frequence | Temps estime |
|----------|-----------|--------------|
| TikToks/Reels | 3-4/semaine | 30 min/video |
| Posts Twitter | Quotidien | 10 min/jour |
| Posts Reddit | 1-2/semaine | 20 min/post |
| Engagement (commentaires, likes) | Quotidien | 20 min/jour |
| Contact influenceurs | 2-3/semaine | 15 min/contact |

### Subreddits a cibler (en rotation)

| Semaine | Subreddit 1 | Subreddit 2 |
|---------|-------------|-------------|
| 2 | r/PokemonTCG | r/OnePieceTCG |
| 3 | r/tcgcollecting | r/StarWarsUnlimited |
| 4 | r/pokemon (discussion) | r/Lorcana (2eme post) |

### Product Hunt et BetaList

```
[ ] BetaList (semaine 2)
    - Soumettre sur https://betalist.com/submit
    - Gratuit, review en 2-3 semaines

[ ] Product Hunt (semaine 4 ou mois 2)
    - Preparer assets specifiques
    - Choisir un mardi ou mercredi (meilleurs jours)
    - Mobiliser communaute pour votes
```

### Micro-influenceurs a contacter

**Criteres** :
- 1k-50k followers
- Contenu TCG regulier
- Engagement actif (commentaires)
- Francophone de preference (pour commencer)

**Template DM** (voir [GO-TO-MARKET.md](./GO-TO-MARKET.md#email-dm-influenceur))

---

## Assets et visuels

### Structure de dossier recommandee

```
marketing/
├── logos/
│   ├── logo-512.png
│   ├── logo-256.png
│   └── logo-round.png
├── banners/
│   ├── twitter-1500x500.png
│   ├── linkedin-1584x396.png
│   └── discord-960x540.png
├── screenshots/
│   ├── home-desktop.png
│   ├── series-list.png
│   ├── cards-grid.png
│   └── mobile-pwa.png
├── social/
│   ├── post-square-1.png
│   ├── post-square-2.png
│   └── story-template.png
└── videos/
    ├── demo-30s.mp4
    └── tiktok-1.mp4
```

### Charte graphique rapide

| Element | Valeur |
|---------|--------|
| Couleur primaire | A definir (gradient actuel ?) |
| Couleur secondaire | A definir |
| Police titres | Inter / System |
| Style | Clean, moderne, coloré (TCG vibe) |

---

## Automatisation

### Outils gratuits pour automatiser

| Tache | Outil | Gratuit ? |
|-------|-------|-----------|
| Planification posts Twitter | Buffer / TweetDeck | Oui (limite) |
| Planification posts LinkedIn | Buffer | Oui (limite) |
| Planification TikTok | TikTok native | Oui |
| Analytics centralises | Google Analytics | Oui |
| Monitoring mentions | Google Alerts | Oui |
| Gestion todo | Notion / Trello | Oui |

### Google Alerts a configurer

```
[ ] "CollectorVerse"
[ ] "pokemon collection app"
[ ] "lorcana collection tracker"
[ ] "tcg collection manager"
```

### Workflow type (automatisable)

```
1. [Dimanche soir] Planifier les posts de la semaine dans Buffer
2. [Quotidien] 15 min engagement (repondre, liker, commenter)
3. [Mardi/Jeudi] Creer et publier nouveau TikTok
4. [Vendredi] Analyser metriques de la semaine
5. [Mensuel] Review et ajustement strategie
```

---

## FAQ et decisions

### Questions en attente

> Ces questions doivent etre repondues avant de lancer :

#### 1. Contenu existant
- [ ] As-tu deja du contenu publie sur Twitter/TikTok/Instagram ?
- [ ] Si oui, quels comptes utiliser ?

#### 2. Visuels
- [ ] As-tu des assets marketing (bannieres, screenshots) prets ?
- [ ] As-tu un logo definitif ?

#### 3. Reddit
- [ ] As-tu un compte Reddit avec du karma ?
- [ ] Si non, prevoir 2 semaines de participation avant de poster

#### 4. Priorite geographique
- [ ] Commencer par FR uniquement ?
- [ ] Ou FR + EN en parallele ?
- [ ] Impact : templates en 2 langues, subreddits differents

#### 5. Budget temps
- [ ] Combien d'heures/semaine disponibles pour le marketing ?
  - < 5h : Focus Twitter + 1 TikTok/semaine + 1 Reddit/semaine
  - 5-10h : Strategie complete recommandee
  - > 10h : Ajouter YouTube, blog, plus d'influenceurs

---

## Metriques de succes

### KPIs Phase 1 (Preparation)

| Metrique | Objectif |
|----------|----------|
| GA4 configure | Oui/Non |
| Search Console OK | Oui/Non |
| Assets prets | 100% |

### KPIs Phase 2 (Soft Launch - Semaine 1)

| Metrique | Objectif |
|----------|----------|
| Followers Twitter | 50+ |
| Vues TikTok | 500+ |
| Upvotes Reddit | 20+ |
| Nouveaux utilisateurs | 50+ |

### KPIs Phase 3 (Croissance - Mois 1)

| Metrique | Objectif |
|----------|----------|
| Followers Twitter | 500+ |
| Total vues TikTok | 10,000+ |
| Utilisateurs inscrits | 500+ |
| Cartes trackees | 50,000+ |

---

## Liens utiles

- [GO-TO-MARKET.md](./GO-TO-MARKET.md) - Strategie complete
- [SEO-SETUP.md](./SEO-SETUP.md) - Configuration technique SEO
- [Canva](https://www.canva.com) - Creation visuels
- [Buffer](https://buffer.com) - Planification posts
- [Google Analytics](https://analytics.google.com)
- [Google Search Console](https://search.google.com/search-console)
- [Product Hunt](https://www.producthunt.com)
- [BetaList](https://betalist.com)

---

## Historique des actions

| Date | Action | Resultat |
|------|--------|----------|
| - | - | - |

> Mettre a jour ce tableau au fur et a mesure des actions effectuees.
