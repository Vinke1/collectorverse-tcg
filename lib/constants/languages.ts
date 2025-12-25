/**
 * Language constants for card display
 */

// Mapping des codes de langue vers les drapeaux
export const LANGUAGE_FLAGS: Record<string, string> = {
  fr: '/images/flags/fr.svg',
  en: '/images/flags/us.svg',
  jp: '/images/flags/jp.svg',
  zh: '/images/flags/zh.svg',
  FR: '/images/flags/fr.svg',
  EN: '/images/flags/us.svg',
  JP: '/images/flags/jp.svg',
  ZH: '/images/flags/zh.svg',
};

// Labels courts pour les langues
export const LANGUAGE_LABELS: Record<string, string> = {
  fr: 'FR',
  en: 'EN',
  jp: 'JP',
  zh: 'ZH',
  FR: 'FR',
  EN: 'EN',
  JP: 'JP',
  ZH: 'ZH',
};

// Ordre de priorité des langues pour l'affichage
export const LANGUAGE_ORDER = ['FR', 'fr', 'EN', 'en', 'JP', 'jp', 'ZH', 'zh'];

/**
 * Get sorted languages from an object with language keys
 * Only returns languages that have a flag defined
 */
export function getSortedLanguages(languages: string[]): string[] {
  const validLanguages = languages.filter(lang => LANGUAGE_FLAGS[lang]);

  return validLanguages.sort((a, b) => {
    const indexA = LANGUAGE_ORDER.indexOf(a);
    const indexB = LANGUAGE_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });
}
