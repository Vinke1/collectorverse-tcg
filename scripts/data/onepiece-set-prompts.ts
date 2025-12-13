/**
 * One Piece Card Game Set Prompts for Higgsfield AI Image Generation
 *
 * Format: 16:9 (2048x1152 or 1920x1080)
 * Style: One Piece anime/manga official artwork
 */

export interface OnePieceSetPrompt {
  id: string
  name: string
  type: 'booster' | 'starter' | 'premium' | 'special' | 'promo'
  prompt: string
}

// Base template for consistency - One Piece anime style
const BASE_STYLE = `One Piece anime official artwork style, illustration by Eiichiro Oda, detailed anime cel-shading, professional trading card game art, 16:9 banner composition, high quality digital illustration, One Piece franchise official art style, dynamic action poses, vibrant colors`

// Helper to create prompt with set name as title text
function createPrompt(setName: string, scene: string): string {
  return `${BASE_STYLE}, ${scene}, with elegant title text "${setName}" displayed prominently at the bottom of the image in One Piece style font`
}

export const ONEPIECE_SET_PROMPTS: OnePieceSetPrompt[] = [
  // ============================================
  // BOOSTER SETS (OP01-OP13)
  // ============================================
  {
    id: 'OP01',
    name: 'Romance Dawn',
    type: 'booster',
    prompt: createPrompt('Romance Dawn', 'Monkey D. Luffy with straw hat standing on the bow of Going Merry ship at sunrise, ocean waves sparkling with adventure spirit, vibrant orange sunrise and deep blue sea colors, beginning of grand adventure atmosphere')
  },
  {
    id: 'OP02',
    name: 'Paramount War',
    type: 'booster',
    prompt: createPrompt('Paramount War', 'Epic battle at Marineford with Whitebeard Edward Newgate clashing against Marines, Ace in chains, massive warships and destruction, intense red orange and navy blue war colors, chaotic legendary war atmosphere')
  },
  {
    id: 'OP03',
    name: 'Pillars of Strength',
    type: 'booster',
    prompt: createPrompt('Pillars of Strength', 'The Four Emperors Yonko standing as pillars of power, Kaido Big Mom Shanks Blackbeard silhouettes against stormy sky, powerful aura emanating, dark purple and gold emperor colors, overwhelming strength atmosphere')
  },
  {
    id: 'OP04',
    name: 'Kingdoms of Intrigue',
    type: 'booster',
    prompt: createPrompt('Kingdoms of Intrigue', 'Alabasta and Dressrosa kingdoms with royal intrigue, Crocodile and Doflamingo scheming in shadows, desert sand and pink flamingo feathers, golden palace and mysterious purple colors, political intrigue atmosphere')
  },
  {
    id: 'OP05',
    name: 'Awakening of the New Era',
    type: 'booster',
    prompt: createPrompt('Awakening of the New Era', 'Luffy in Gear 5 Nika form with white hair laughing joyfully, sun god awakening powers radiating, cartoon-like transformation effects, bright white and rainbow joy colors, new era dawn awakening atmosphere')
  },
  {
    id: 'OP06',
    name: 'Wings of the Captain',
    type: 'booster',
    prompt: createPrompt('Wings of the Captain', 'Zoro and Sanji as the wings of Luffy, standing back to back in powerful poses, green sword aura and flaming leg attacks, emerald green and fiery orange colors, loyal crew strength atmosphere')
  },
  {
    id: 'OP07',
    name: '500 Years in the Future',
    type: 'booster',
    prompt: createPrompt('500 Years in the Future', 'Ancient Kingdom ruins and Void Century secrets, Poneglyphs with mysterious inscriptions glowing, Dr. Vegapunk technology and ancient weapons, mystical blue and ancient gold colors, mysterious future past atmosphere')
  },
  {
    id: 'OP08',
    name: 'Two Legends',
    type: 'booster',
    prompt: createPrompt('Two Legends', 'Gol D. Roger and Whitebeard Edward Newgate facing each other as legendary rivals, Oro Jackson and Moby Dick ships in background, legendary golden and white aura colors, clash of legends atmosphere')
  },
  {
    id: 'OP09',
    name: 'The Four Emperors',
    type: 'booster',
    prompt: createPrompt('The Four Emperors', 'Kaido in dragon form, Big Mom with homies, Shanks with Red Hair Pirates, Blackbeard with darkness powers, four corners of power converging, emperor red gold purple and black colors, ultimate power gathering atmosphere')
  },
  {
    id: 'OP10',
    name: 'Royal Blood',
    type: 'booster',
    prompt: createPrompt('Royal Blood', 'Celestial Dragons and World Nobles in Mariejois, Im-sama silhouette on Empty Throne, noble bloodlines and ancient power, royal purple and corrupted gold colors, dark nobility atmosphere')
  },
  {
    id: 'OP11',
    name: 'Endless Dream',
    type: 'booster',
    prompt: createPrompt('Endless Dream', 'All Straw Hat crew members reaching for their dreams, Luffy becoming Pirate King, All Blue, world map, True History, cure for all diseases, dream symbols floating, rainbow and starlight colors, endless dreams atmosphere')
  },
  {
    id: 'OP12',
    name: "Master's Legacy",
    type: 'booster',
    prompt: createPrompt("Master's Legacy", 'Silvers Rayleigh training Luffy, Mihawk training Zoro, master and student bonds, powerful mentors passing down legacy, wise silver and student growth green colors, master legacy teaching atmosphere')
  },
  {
    id: 'OP13',
    name: 'Successors',
    type: 'booster',
    prompt: createPrompt('Successors', 'New generation inheriting the will of D, Luffy Ace Sabo brotherhood, inherited straw hat and flames, next generation rising to greatness, succession orange and destiny gold colors, new generation successors atmosphere')
  },

  // ============================================
  // STARTER DECKS (ST01-ST22)
  // ============================================
  {
    id: 'ST01',
    name: 'Straw Hat Crew',
    type: 'starter',
    prompt: createPrompt('Straw Hat Crew', 'All Straw Hat Pirates crew together on Thousand Sunny deck, Luffy Zoro Nami Usopp Sanji Chopper Robin Franky Brook Jinbe, nakama friendship bonds, crew warm orange and sunny colors, nakama adventure atmosphere')
  },
  {
    id: 'ST02',
    name: 'Worst Generation',
    type: 'starter',
    prompt: createPrompt('Worst Generation', 'Supernovas of Worst Generation assembled, Law Kid Hawkins Drake Bonney Apoo Capone Urouge Killer, rookie pirates with high bounties, rebellious red and chaotic colors, worst generation chaos atmosphere')
  },
  {
    id: 'ST03',
    name: 'The Seven Warlords',
    type: 'starter',
    prompt: createPrompt('Seven Warlords', 'Shichibukai warlords of the sea, Mihawk Crocodile Hancock Doflamingo Kuma Moria Jinbe, government allied pirates, warlord purple and sea blue colors, powerful warlords atmosphere')
  },
  {
    id: 'ST04',
    name: 'Animal Kingdom Pirates',
    type: 'starter',
    prompt: createPrompt('Animal Kingdom Pirates', 'Kaido and Beast Pirates in Onigashima, King Queen Jack All-Stars, SMILE devil fruit users, beast brown and fierce purple colors, animal kingdom terror atmosphere')
  },
  {
    id: 'ST05',
    name: 'ONE PIECE FILM edition',
    type: 'starter',
    prompt: createPrompt('FILM Edition', 'One Piece movies celebration, Film Red Uta singing, Shiki golden lion, Z former admiral, Tesoro golden casino, movie premiere gold and cinematic colors, movie special edition atmosphere')
  },
  {
    id: 'ST06',
    name: 'Navy',
    type: 'starter',
    prompt: createPrompt('Navy', 'Marine Headquarters admirals and officers, Akainu Aokiji Kizaru Fleet Admiral Sengoku Garp, justice capes flowing, marine justice white and blue colors, absolute justice navy atmosphere')
  },
  {
    id: 'ST07',
    name: 'Big Mom Pirates',
    type: 'starter',
    prompt: createPrompt('Big Mom Pirates', 'Charlotte Linlin Big Mom with homies Zeus Prometheus Napoleon, Charlotte family Katakuri Smoothie Cracker, Whole Cake Island sweets, candy pink and cream colors, big mom pirates feast atmosphere')
  },
  {
    id: 'ST08',
    name: 'Monkey D. Luffy',
    type: 'starter',
    prompt: createPrompt('Monkey D. Luffy', 'Luffy in all his forms and transformations, Gear 2 3 4 5 evolution, rubber powers stretching and bouncing, Luffy signature red and straw yellow colors, rubber man power evolution atmosphere')
  },
  {
    id: 'ST09',
    name: 'Yamato',
    type: 'starter',
    prompt: createPrompt('Yamato', 'Yamato Oni Princess with Oden journal, ice powers and kanabo club, Kaido daughter wanting to be Oden, ice blue and white Oden homage colors, freedom seeking Yamato atmosphere')
  },
  {
    id: 'ST10',
    name: 'The Three Captains',
    type: 'starter',
    prompt: createPrompt('The Three Captains', 'Luffy Law and Kid alliance against Kaido and Big Mom, three captains combining powers, worst generation teamwork, alliance red blue and purple colors, three captains alliance atmosphere')
  },
  {
    id: 'ST11',
    name: 'Uta',
    type: 'starter',
    prompt: createPrompt('Uta', 'Uta the diva with Tot Musica power, singing with microphone on concert stage, Film Red music powers, idol pink and musical note colors, singing diva concert atmosphere')
  },
  {
    id: 'ST12',
    name: 'Zoro & Sanji',
    type: 'starter',
    prompt: createPrompt('Zoro & Sanji', 'Roronoa Zoro with three swords Enma and Vinsmoke Sanji with Ifrit Jambe, eternal rivals and partners, green sword aura versus blue flame kicks, rivalry green and blue fire colors, rival duo atmosphere')
  },
  {
    id: 'ST13',
    name: 'The Three Brothers',
    type: 'starter',
    prompt: createPrompt('The Three Brothers', 'Luffy Ace and Sabo as sworn brothers, ASL childhood bond cups of sake, Flame Flame Fruit legacy, brotherhood warm orange and flame colors, sworn brothers bond atmosphere')
  },
  {
    id: 'ST14',
    name: '3D2Y',
    type: 'starter',
    prompt: createPrompt('3D2Y', 'Two years of training after Marineford, Luffy with 3D2Y message, crew separation and reunion, timeskip growth and determination, training montage colors, 3D2Y determination atmosphere')
  },
  {
    id: 'ST15',
    name: 'RED Edward Newgate',
    type: 'starter',
    prompt: createPrompt('RED Newgate', 'Whitebeard Edward Newgate with Murakumogiri bisento, earthquake Gura Gura powers, strongest man in the world, powerful red and white tremor colors, strongest man legend atmosphere')
  },
  {
    id: 'ST16',
    name: 'GREEN Uta',
    type: 'starter',
    prompt: createPrompt('GREEN Uta', 'Uta in green color scheme concert performance, musical powers and singing, Shanks daughter diva, green musical harmony colors, green Uta performance atmosphere')
  },
  {
    id: 'ST17',
    name: 'BLUE Donquixote Doflamingo',
    type: 'starter',
    prompt: createPrompt('BLUE Doflamingo', 'Donquixote Doflamingo with string powers and sunglasses, Heavenly Demon Joker smiling menacingly, puppet master strings, blue string control colors, heavenly demon manipulation atmosphere')
  },
  {
    id: 'ST18',
    name: 'PURPLE Monkey D. Luffy',
    type: 'starter',
    prompt: createPrompt('PURPLE Luffy', 'Luffy in purple color scheme with Gear powers, determined captain leading crew, future Pirate King aura, purple determination colors, purple Luffy captain atmosphere')
  },
  {
    id: 'ST19',
    name: 'BLACK Smoker',
    type: 'starter',
    prompt: createPrompt('BLACK Smoker', 'Vice Admiral Smoker with smoke logia powers, jitte weapon and cigars, marine chasing Straw Hats, black smoke and marine colors, relentless pursuer atmosphere')
  },
  {
    id: 'ST20',
    name: 'YELLOW Charlotte Katakuri',
    type: 'starter',
    prompt: createPrompt('YELLOW Katakuri', 'Charlotte Katakuri with mochi powers and trident, future sight observation haki, Big Mom strongest son, yellow mochi and donut colors, perfect warrior Katakuri atmosphere')
  },
  {
    id: 'ST21',
    name: 'Gear 5',
    type: 'starter',
    prompt: createPrompt('Gear 5', 'Luffy Gear 5 Nika awakening full transformation, white hair and laughing joyfully, sun god liberation powers, bright white and joyful rainbow colors, Nika sun god liberation atmosphere')
  },
  {
    id: 'ST22',
    name: 'Ace & Newgate',
    type: 'starter',
    prompt: createPrompt('Ace & Newgate', 'Portgas D. Ace with Whitebeard father and son bond, Fire Fist flames and Whitebeard protection, Moby Dick crew family, flame orange and family white colors, father son bond atmosphere')
  },

  // ============================================
  // PREMIUM COLLECTIONS (PRB)
  // ============================================
  {
    id: 'PRB01',
    name: 'The Best Vol.1',
    type: 'premium',
    prompt: createPrompt('The Best Vol.1', 'Best cards collection showcase with iconic characters, Luffy Ace Shanks Roger legendary moments, premium golden frames and sparkles, premium gold and collector edition colors, best collection premium atmosphere')
  },
  {
    id: 'PRB02',
    name: 'The Best Vol.2',
    type: 'premium',
    prompt: createPrompt('The Best Vol.2', 'Second best cards collection with more legends, Whitebeard Kaido Big Mom iconic scenes, premium platinum frames and holographic effects, platinum and collector special colors, best collection volume 2 atmosphere')
  },

  // ============================================
  // SPECIAL EDITIONS (EB)
  // ============================================
  {
    id: 'EB01',
    name: 'Memorial Collection',
    type: 'special',
    prompt: createPrompt('Memorial Collection', 'Memorial tribute to One Piece journey, iconic scenes and emotional moments, Going Merry funeral Ace death Luffy journey, memorial soft golden and nostalgic sepia colors, memorial emotional collection atmosphere')
  },

  // ============================================
  // PROMOTIONAL CARDS
  // ============================================
  {
    id: 'P',
    name: 'Promotional Cards',
    type: 'promo',
    prompt: createPrompt('Promo Cards', 'Special promotional One Piece cards collection, exclusive event cards with golden promo stamps, tournament prizes and special editions, promo gold and exclusive sparkle colors, promotional exclusive atmosphere')
  },
  {
    id: 'STP',
    name: 'Tournament & Shop Promos',
    type: 'promo',
    prompt: createPrompt('Tournament Promos', 'Tournament and shop exclusive promotional cards, competitive battle scenes and prize cards, championship trophy and store events, tournament silver and shop special colors, competitive promo atmosphere')
  },
]

// Export count for reference
export const TOTAL_PROMPTS = ONEPIECE_SET_PROMPTS.length
