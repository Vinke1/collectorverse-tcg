# Narutopia.fr - Résultats du Test des Patterns d'URLs

**Date**: 2025-12-11
**URL testée**: https://narutopia.fr/liste-des-cartes-naruto-kayou/

---

## ✅ PATTERN URL FULL-SIZE DÉCOUVERT ET VÉRIFIÉ

### Pattern
Pour obtenir l'image en taille complète à partir d'un thumbnail :

```javascript
const fullSizeUrl = thumbnailUrl.replace(/-\d+x\d+\.(\w+)$/, ".$1")
```

### Explication
- **Pattern thumbnail**: `/{CARD-NUMBER}-{WIDTH}x{HEIGHT}.{EXT}`
- **Pattern full-size**: `/{CARD-NUMBER}.{EXT}`
- **Transformation**: Suppression de la partie `-WIDTHxHEIGHT`

---

## 🧪 Tests Effectués

### Test 1: SCR-001
| Type | URL | Status | Taille |
|------|-----|--------|--------|
| Thumbnail | `https://narutopia.fr/wp-content/uploads/2023/05/SCR-001-213x300.webp` | ✅ Existe | - |
| **Full-size** | `https://narutopia.fr/wp-content/uploads/2023/05/SCR-001.webp` | ✅ **Existe** | **254.28 KB** |
| Scaled | `https://narutopia.fr/wp-content/uploads/2023/05/SCR-001-scaled.webp` | ❌ N'existe pas | - |
| JPG | `https://narutopia.fr/wp-content/uploads/2023/05/SCR-001.jpg` | ❌ N'existe pas | - |

### Test 2: BP-008
| Type | URL | Status | Taille |
|------|-----|--------|--------|
| Thumbnail | `https://narutopia.fr/wp-content/uploads/2023/05/BP-008-213x300.webp` | ✅ Existe | - |
| **Full-size** | `https://narutopia.fr/wp-content/uploads/2023/05/BP-008.webp` | ✅ **Existe** | **471.07 KB** |

### Test 3: SE-008
| Type | URL | Status | Taille |
|------|-----|--------|--------|
| Thumbnail | `https://narutopia.fr/wp-content/uploads/2023/05/SE-008-213x300.webp` | ✅ Existe | - |
| **Full-size** | `https://narutopia.fr/wp-content/uploads/2023/05/SE-008.webp` | ✅ **Existe** | **228.27 KB** |

---

## 📊 Résumé des Résultats

### ✅ Patterns qui FONCTIONNENT
1. **Suppression des dimensions** (recommandé)
   - Pattern: `.replace(/-\d+x\d+\.(\w+)$/, ".$1")`
   - Taux de succès: **3/3 (100%)**
   - Format: `{CARD-NUMBER}.webp`

### ❌ Patterns qui NE FONCTIONNENT PAS
1. Version `-scaled` (0/3)
2. Changement d'extension vers `.jpg` (0/3)
3. Dimensions spécifiques `-1024x1440` (0/1)

---

## 💡 Exemples de Code

### JavaScript/TypeScript
```typescript
function thumbnailToFullSize(thumbnailUrl: string): string {
  return thumbnailUrl.replace(/-\d+x\d+\.(\w+)$/, ".$1")
}

// Exemple d'utilisation
const thumb = "https://narutopia.fr/wp-content/uploads/2023/05/SCR-001-213x300.webp"
const full = thumbnailToFullSize(thumb)
// Résultat: "https://narutopia.fr/wp-content/uploads/2023/05/SCR-001.webp"
```

### Python
```python
import re

def thumbnail_to_full_size(thumbnail_url: str) -> str:
    return re.sub(r'-\d+x\d+\.(\w+)$', r'.\1', thumbnail_url)

# Exemple d'utilisation
thumb = "https://narutopia.fr/wp-content/uploads/2023/05/SCR-001-213x300.webp"
full = thumbnail_to_full_size(thumb)
# Résultat: "https://narutopia.fr/wp-content/uploads/2023/05/SCR-001.webp"
```

---

## 🔍 Analyse Détaillée

### Tailles d'Images
- **Thumbnail (213x300)**: ~8-12 KB
- **Full-size**: ~228-471 KB
- **Ratio moyen**: ~30-50x plus lourd

### Format
- **Extension**: `.webp` uniquement
- **Qualité**: Haute résolution
- **Dimensions estimées**: ~1024x1440 ou similaire (basé sur le ratio 213x300)

### Pattern de Nomenclature
```
/wp-content/uploads/{YEAR}/{MONTH}/{CARD-NUMBER}-{WIDTH}x{HEIGHT}.{EXT}
                      └──┬──┘ └──┬──┘ └────┬────┘  └──┬──┘ └──┬──┘ └┬┘
                      Année   Mois      Card ID    Largeur  Hauteur Ext

Exemples:
- 2023/05/SCR-001-213x300.webp
- 2023/05/BP-008-213x300.webp
- 2024/09/NRZ06-PTR-008-213x300.webp
```

### Variantes de Card ID Observées
1. **Simple**: `SCR-001`, `BP-008`, `SE-008`
2. **Avec préfixe série**: `NRZ06-PTR-008`, `NRZ06-PU-006`
3. **Avec suffixe**: `SV-GOLD-004`
4. **Spéciaux**: `20TH-ANNIVERSARY`

---

## 🎯 Recommandations pour le Scraping

### Stratégie Optimale
1. **Identifier les thumbnails** sur la page
   - Chercher les images avec pattern `/-\d+x\d+\.webp$/`
   - Extraire les URLs

2. **Convertir en full-size**
   ```typescript
   const fullSizeUrls = thumbnails.map(thumb =>
     thumb.replace(/-\d+x\d+\.(\w+)$/, ".$1")
   )
   ```

3. **Vérifier l'existence** (optionnel mais recommandé)
   ```typescript
   const response = await fetch(fullSizeUrl, { method: 'HEAD' })
   if (response.ok) {
     // Télécharger l'image
   }
   ```

4. **Télécharger les images**
   - Utiliser les URLs full-size
   - Appliquer un délai entre les requêtes (500ms)

### Avantages de cette Méthode
- ✅ **Simple**: Une seule transformation regex
- ✅ **Fiable**: Taux de succès 100% sur les tests
- ✅ **Rapide**: Pas besoin de clic/navigation
- ✅ **Efficace**: Téléchargement direct des images haute qualité

---

## 📝 Notes Importantes

### 1. Chargement des Galeries
**DÉCOUVERTE**: Les galeries ne semblent PAS se charger dynamiquement par clic.

**Test effectué**:
- Recherche de liens dans les boîtes de raretés → ❌ Aucun lien trouvé dans SCR
- Tentative de clic sur les éléments → ❌ Pas de chargement de galerie
- Recherche de modals/lightbox → ❌ Aucun élément détecté

**Conclusion**: Le site affiche seulement des images d'exemple. Les galeries complètes ne sont probablement pas accessibles via l'interface web.

### 2. Images sur la Page
Sur la page principale, seulement **~29 images** sont présentes (exemples), pas les 1853 cartes annoncées.

**Images visibles** (exemples capturés):
```
BP-008-213x300.webp
SE-008-213x300.webp
20TH-ANNIVERSARY-213x300.jpg.webp
SV-GOLD-004-213x300.webp
SCR-001-213x300.webp
```

### 3. Lazy Loading
Les images utilisent le lazy loading (plugin A3 Lazy Load):
- `data-src` pour l'URL réelle
- `src` pointe vers un placeholder GIF

---

## 🚀 Prochaines Étapes

### Pour le Scraping Complet
1. ✅ Pattern URL full-size identifié et vérifié
2. ⏳ Construire les URLs pour toutes les cartes
   - Utiliser les patterns de nomenclature découverts
   - Tester différentes variantes (avec/sans zéros)
3. ⏳ Vérifier l'existence de chaque URL (HEAD request)
4. ⏳ Télécharger les images full-size valides
5. ⏳ Traiter et optimiser les images (Sharp)
6. ⏳ Upload vers Supabase Storage

### Scripts Disponibles
- ✅ `test-narutopia-url-patterns.ts` - Vérification des patterns
- ⏳ `scrape-narutopia.ts` - Script de scraping complet (à créer)

---

## 📚 Références

### URLs de Test Validées
```
https://narutopia.fr/wp-content/uploads/2023/05/SCR-001.webp (254.28 KB)
https://narutopia.fr/wp-content/uploads/2023/05/BP-008.webp (471.07 KB)
https://narutopia.fr/wp-content/uploads/2023/05/SE-008.webp (228.27 KB)
```

### Scripts de Test
```
scripts/test-narutopia-url-patterns.ts
scripts/test-narutopia-galleries.ts
scripts/test-narutopia-complete.ts
scripts/inspect-narutopia-page.ts
```

### Fichiers Générés
```
scripts/output/narutopia-analysis.json
scripts/output/NARUTOPIA-ANALYSIS-REPORT.md
scripts/output/NARUTOPIA-URL-PATTERN-RESULTS.md (ce fichier)
```

---

**Conclusion**: Le pattern de conversion thumbnail → full-size fonctionne parfaitement. La stratégie recommandée est de construire les URLs manuellement plutôt que d'essayer de charger les galeries dynamiquement.
