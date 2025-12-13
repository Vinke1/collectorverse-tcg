/**
 * Star Wars Unlimited Set Prompts for Higgsfield AI Image Generation
 *
 * Format: 16:9 (2048x1152 or 1920x1080)
 * Style: Star Wars cinematic artwork
 */

export interface StarWarsSetPrompt {
  id: string
  name: string
  type: 'booster' | 'weekly' | 'promo'
  prompt: string
}

// Base template for consistency - includes set title text
const BASE_STYLE = `Star Wars official cinematic artwork style, illustration by Ralph McQuarrie and Doug Chiang, detailed sci-fi art, professional trading card game art, 16:9 banner composition, high quality digital illustration, Star Wars franchise official art style, epic space opera atmosphere`

// Helper to create prompt with set name as title text
function createPrompt(setName: string, scene: string): string {
  return `${BASE_STYLE}, ${scene}, with elegant title text "${setName}" displayed prominently at the bottom of the image in Star Wars style font`
}

export const STARWARS_SET_PROMPTS: StarWarsSetPrompt[] = [
  // ============================================
  // BOOSTER SETS (Main expansions)
  // ============================================
  {
    id: 'SOR',
    name: 'Spark of Rebellion',
    type: 'booster',
    prompt: createPrompt('Spark of Rebellion', 'rebel alliance X-wing starfighters igniting battle against Imperial Star Destroyers, sparks and laser fire illuminating dark space, rebellion logo glowing with hope, dramatic orange and red explosion colors against cold blue Imperial forces, heroic defiance atmosphere')
  },
  {
    id: 'SHD',
    name: 'Shadows of the Galaxy',
    type: 'booster',
    prompt: createPrompt('Shadows of the Galaxy', 'mysterious bounty hunters and smugglers in dark cantina on Nar Shaddaa, shadowy figures with blasters in neon-lit underworld, Mandalorian armor reflecting dim lights, criminal syndicates gathering in shadows, moody purple and green noir lighting, dangerous galactic underworld atmosphere')
  },
  {
    id: 'TWI',
    name: 'Twilight of the Republic',
    type: 'booster',
    prompt: createPrompt('Twilight of the Republic', 'Jedi Temple on Coruscant at sunset with Clone Wars raging in background, lightsabers crossed in epic duel, Republic gunships flying past, melancholic orange twilight sky fading to dark purple, fallen Jedi Order and crumbling democracy, tragic end of an era atmosphere')
  },
  {
    id: 'JTL',
    name: 'Jump to Lightspeed',
    type: 'booster',
    prompt: createPrompt('Jump to Lightspeed', 'Millennium Falcon and starfighters entering hyperspace tunnel, blue streaking stars and light trails, cockpit view with hyperdrive engaged, multiple ships racing through hyperspace corridor, electric blue and white motion blur, thrilling high-speed chase atmosphere')
  },
  {
    id: 'LOF',
    name: 'Legends of the Force',
    type: 'booster',
    prompt: createPrompt('Legends of the Force', 'ancient Force users and legendary Jedi Masters gathered in mystical Force nexus, glowing Force ghosts of Yoda Obi-Wan and Anakin, Sith and Jedi holocrons floating with knowledge, ethereal blue Force energy swirling, legendary wisdom of ages atmosphere')
  },
  {
    id: 'SEC',
    name: 'Secrets of Power',
    type: 'booster',
    prompt: createPrompt('Secrets of Power', 'hidden Sith temple with ancient dark side artifacts, Emperor Palpatine channeling Force lightning, mysterious holocrons revealing forbidden knowledge, deep crimson and purple dark side energy, ominous shadows concealing terrible power, forbidden secrets and corruption atmosphere')
  },

  // ============================================
  // WEEKLY PLAY SETS
  // ============================================
  {
    id: 'WSOR',
    name: 'Weekly Play - Spark of Rebellion',
    type: 'weekly',
    prompt: createPrompt('Weekly Play SOR', 'rebel pilots celebrating victory in hangar bay, medals and commendations ceremony, competitive card game tournament feeling, warm golden lights and rebel alliance banners, players gathering for weekly battles, friendly competition and community atmosphere')
  },
  {
    id: 'WSHD',
    name: 'Weekly Play - Shadows of the Galaxy',
    type: 'weekly',
    prompt: createPrompt('Weekly Play SHD', 'sabacc game in progress at smugglers cantina table, holographic cards and credits on table, diverse alien players competing, atmospheric cantina lighting with tournament energy, strategic gameplay and gambling stakes, underground competition atmosphere')
  },
  {
    id: 'WTWI',
    name: 'Weekly Play - Twilight of the Republic',
    type: 'weekly',
    prompt: createPrompt('Weekly Play TWI', 'Jedi younglings in training arena practicing with training sabers, Clone cadets in background, competitive sparring matches, Jedi Temple training grounds, warm amber lighting, learning and growth through competition atmosphere')
  },
  {
    id: 'WJTL',
    name: 'Weekly Play - Jump to Lightspeed',
    type: 'weekly',
    prompt: createPrompt('Weekly Play JTL', 'starfighter pilots in briefing room with holographic battle plans, squadron competition for best pilot, flight simulator screens showing race times, competitive pilot rankings, dynamic blue holo-displays, elite pilot training atmosphere')
  },
  {
    id: 'WLOF',
    name: 'Weekly Play - Legends of the Force',
    type: 'weekly',
    prompt: createPrompt('Weekly Play LOF', 'Force-sensitive students meditating in ancient temple garden, Jedi and Sith teachings displayed on holocrons, tournament of Force abilities, mystical purple and blue energy surrounding competitors, wisdom and skill competition atmosphere')
  },

  // ============================================
  // PROMOTIONAL CARDS
  // ============================================
  {
    id: 'OP',
    name: 'Promotional Cards',
    type: 'promo',
    prompt: createPrompt('Promotional Cards', 'exclusive golden Star Wars collectibles display with rare cards floating in spotlight, galactic symbols and iconic characters in premium showcase, shimmering gold and silver special edition presentation, collector vault with limited treasures, premium exclusive promotional atmosphere')
  },
]

// Export count for reference
export const TOTAL_PROMPTS = STARWARS_SET_PROMPTS.length
