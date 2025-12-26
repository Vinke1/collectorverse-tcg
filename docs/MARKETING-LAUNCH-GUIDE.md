# Marketing Launch Guide - CollectorVerse TCG

> **Last updated**: December 2024
> **Status**: Pre-launch
> **Ad budget**: $0

Minimal effort launch strategy: one message + one image per platform.

---

## Table of Contents

1. [Launch Dashboard](#launch-dashboard)
2. [Phase 1: Technical Setup](#phase-1-technical-setup)
3. [Phase 2: Launch Day](#phase-2-launch-day)
4. [Phase 3: Growth](#phase-3-growth)
5. [Assets Checklist](#assets-checklist)
6. [Message Templates](#message-templates)
7. [Automation](#automation)

---

## Launch Dashboard

### Marketing Status

| Item                     | Status      | Priority | Notes |
|--------------------------|-------------|----------|-------|
| Marketing visuals        | To check    | High     | 1 image per platform |
| Reddit account (karma)   | To check    | High     | Need 100+ karma |
| Twitter/X account        | To check    | High     | - |
| TikTok account           | To check    | High     | - |
| Discord server           | To check    | High     | Main community hub |
| Product Hunt listing     | Not done    | Medium   | Wait for traction |
| BetaList listing         | Not done    | Medium   | Submit week 2 |
| Influencer outreach      | Not done    | Medium   | Start week 3 |

### Technical Prerequisites

| Item | Status | Doc |
|------|--------|-----|
| sitemap.xml | Done | [SEO-SETUP.md](./SEO-SETUP.md) |
| robots.txt | Done | [SEO-SETUP.md](./SEO-SETUP.md) |
| Google Analytics 4 | To configure | [SEO-SETUP.md](./SEO-SETUP.md) |
| Google Search Console | To configure | [SEO-SETUP.md](./SEO-SETUP.md) |

---

## Phase 1: Technical Setup

**Duration**: 2 days

### Day 1: SEO & Analytics

```
[ ] Configure Google Analytics 4
    - Create GA4 property
    - Get Measurement ID (G-XXXXXXXXXX)
    - Add to .env.local: NEXT_PUBLIC_GA_MEASUREMENT_ID=
    - Redeploy

[ ] Configure Google Search Console
    - Add property: https://collectorverse.io
    - Verify ownership
    - Submit sitemap.xml
```

### Day 2: Create Assets

**You need exactly 3 images:**

| Asset | Dimensions | Used on |
|-------|------------|---------|
| Banner (landscape) | 1200x630 px | Twitter, Reddit, Discord announcement |
| Square | 1080x1080 px | Instagram, TikTok profile |
| Vertical | 1080x1920 px | TikTok video, Instagram Story |

**What to show:**
- App screenshot with multiple TCGs visible
- Text overlay: "Track all your TCG collections in one place"
- Logo + URL

---

## Phase 2: Launch Day

### One Message Per Platform

**Goal**: Post everywhere the same day, invite people to Discord.

#### Launch Checklist

```
[ ] 1. Twitter/X
    - Post message + banner image
    - Pin the tweet

[ ] 2. Reddit (r/pokemoncardcollectors first)
    - Post message (no direct link in post)
    - Add link in comments

[ ] 3. TikTok
    - Post 15-30s screen recording of the app
    - Use trending sound
    - Text overlay + CTA

[ ] 4. Instagram
    - Post square image
    - Story with link

[ ] 5. Discord servers (TCG communities)
    - Share in appropriate channels
    - Invite to your Discord

[ ] 6. Your own Discord
    - Announcement in #announcements
```

---

## Phase 3: Growth

### Weekly Rhythm (Minimal Effort)

| Day | Action | Time |
|-----|--------|------|
| Monday | 1 Tweet + engagement | 15 min |
| Tuesday | 1 TikTok | 30 min |
| Wednesday | Reddit engagement | 15 min |
| Thursday | 1 Tweet | 10 min |
| Friday | 1 Reddit post (different sub) | 20 min |
| Weekend | Discord engagement | 20 min |

**Total: ~2 hours/week**

### Reddit Rotation

| Week | Subreddit |
|------|-----------|
| 1 | r/pokemoncardcollectors |
| 2 | r/Lorcana |
| 3 | r/OnePieceTCG |
| 4 | r/PokemonTCG |
| 5 | r/StarWarsUnlimited |
| 6 | r/tcgcollecting |

---

## Assets Checklist

### Required Assets (Minimum)

```
[ ] 1. Banner image (1200x630)
    - For: Twitter, Reddit, Discord, Open Graph

[ ] 2. Square image (1080x1080)
    - For: Instagram post, TikTok profile

[ ] 3. Screen recording (15-30s)
    - For: TikTok, Instagram Reel
    - Show: Browse TCGs > Open series > See cards > Add to collection
```

### Folder Structure

```
marketing/
├── banner-1200x630.png
├── square-1080x1080.png
├── video-demo.mp4
└── logo-512.png
```

---

## Message Templates

### Main Launch Message (adapt per platform)

**English version:**

```
Track all your TCG collections in one place

Finally, one app for Pokemon, Lorcana, One Piece, Star Wars & more.

- 100% Free
- Works on mobile & desktop
- All cards, all languages

Join our Discord for updates and feature requests!

[Discord link]
[App link]
```

### Twitter/X

```
Finally, one app for ALL your TCG collections

Pokemon + Lorcana + One Piece + Star Wars + Riftbound

- Free forever
- Mobile & desktop
- Track your progress

Beta is live! Join our Discord

[link]

#PokemonTCG #Lorcana #OnePieceTCG #TCG
```

### Reddit Title

```
I built a free app to track all your TCG collections (Pokemon, Lorcana, One Piece, Star Wars) - Looking for feedback!
```

### Reddit Body

```
Hey collectors!

I was tired of using separate apps for each TCG I collect, so I built CollectorVerse - a free web app that tracks everything in one place.

**What it does:**
- Track cards across Pokemon, Lorcana, One Piece, Star Wars Unlimited, and Riftbound
- See your completion progress per set
- Works on phone and desktop (PWA)
- Multiple languages supported

**What I'm looking for:**
- Feedback on missing features
- Bug reports
- TCGs you'd like to see added

The app is free and will stay free. Link in my profile if you want to try it.

Also started a Discord if you want to chat or suggest features: [Discord link]
```

### TikTok/Reel Caption

```
POV: You finally find an app for ALL your card collections

#pokemontcg #lorcana #onepiecetcg #tcg #cardcollector #pokemon
```

### Discord Announcement

```
@everyone

**CollectorVerse is now in open beta!**

Track all your TCG collections in one place:
- Pokemon
- Disney Lorcana
- One Piece
- Star Wars Unlimited
- Riftbound

**Try it now:** [link]

Drop your feedback in #suggestions!
```

---

## Automation

### Tools (Free)

| Task | Tool |
|------|------|
| Schedule tweets | TweetDeck (free) |
| Schedule TikToks | TikTok native scheduling |
| Track mentions | Google Alerts |
| Analytics | Google Analytics |

### Google Alerts to Create

```
[ ] "CollectorVerse"
[ ] "tcg collection app"
[ ] "pokemon collection tracker"
```

### Weekly Workflow

```
Sunday: Plan and schedule all posts for the week (1 hour)
Daily: 10 min engagement (reply to comments/mentions)
```

---

## Discord Strategy

### Why Discord is the Hub

- Direct communication with users
- Feature requests and feedback
- Community building
- Less algorithm-dependent than social media

### Discord CTA on Every Post

Always end with:
```
Join our Discord: [link]
```

### Discord Server Structure (Minimal)

```
# INFO
├── welcome
├── announcements
└── rules

# COMMUNITY
├── general
├── suggestions
└── bug-reports

# COLLECTIONS
├── pokemon
├── lorcana
├── one-piece
└── star-wars
```

---

## Success Metrics

### Week 1

| Metric | Target |
|--------|--------|
| Discord members | 50+ |
| App signups | 100+ |
| Twitter followers | 100+ |

### Month 1

| Metric | Target |
|--------|--------|
| Discord members | 200+ |
| App signups | 500+ |
| Cards tracked | 50,000+ |

---

## Quick Reference

### Image Dimensions

| Platform | Size |
|----------|------|
| Twitter banner | 1500x500 |
| Twitter post | 1200x675 |
| Reddit | 1200x630 |
| Instagram post | 1080x1080 |
| Instagram story | 1080x1920 |
| TikTok | 1080x1920 |
| Discord banner | 960x540 |
| Open Graph | 1200x630 |

### Hashtags

```
#PokemonTCG #Pokemon #Lorcana #DisneyLorcana #OnePieceTCG
#StarWarsUnlimited #TCG #CardCollector #CardCollection
```

---

## Action Log

| Date | Action | Result |
|------|--------|--------|
| - | - | - |

> Update this table as you complete actions.

---

## Related Docs

- [GO-TO-MARKET.md](./GO-TO-MARKET.md) - Full marketing strategy
- [SEO-SETUP.md](./SEO-SETUP.md) - Technical SEO setup
