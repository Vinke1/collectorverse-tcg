/**
 * Pokemon TCG Set Prompts for Higgsfield AI Image Generation
 *
 * Format: 16:9 (2048x1152 or 1920x1080)
 * Style: Pokemon TCG official card artwork
 */

export interface PokemonSetPrompt {
  id: string
  name: string
  era: string
  prompt: string
}

// Base template for consistency - includes set title text
const BASE_STYLE = `Pokemon TCG official card artwork style, illustration by Ken Sugimori and Mitsuhiro Arita, detailed cel-shading, professional trading card game art, 16:9 banner composition, high quality digital illustration, Pokemon franchise official art style`

// Helper to create prompt with set name as title text
function createPrompt(setName: string, scene: string): string {
  return `${BASE_STYLE}, ${scene}, with elegant title text "${setName}" displayed prominently at the bottom of the image in Pokemon style font`
}

export const POKEMON_SET_PROMPTS: PokemonSetPrompt[] = [
  // ============================================
  // BASE SERIES (1999-2000)
  // ============================================
  {
    id: 'base1',
    name: 'Base Set',
    era: 'base',
    prompt: createPrompt('Base Set', 'Charizard breathing intense flames in powerful stance, vibrant orange red and yellow colors, nostalgic classic adventure atmosphere')
  },
  {
    id: 'base2',
    name: 'Jungle',
    era: 'base',
    prompt: createPrompt('Jungle', 'Scyther slashing through dense tropical jungle with Venomoth flying nearby, vibrant green and emerald colors, wild untamed nature atmosphere')
  },
  {
    id: 'basep',
    name: 'Wizards Black Star Promos',
    era: 'base',
    prompt: createPrompt('Black Star Promos', 'Pikachu surrounded by golden star sparkles and magical energy, vibrant yellow and gold colors, special exclusive rare atmosphere')
  },
  {
    id: 'base3',
    name: 'Fossil',
    era: 'base',
    prompt: createPrompt('Fossil', 'Aerodactyl and Kabutops emerging from ancient amber fossils in prehistoric cave, earthy brown amber and stone colors, ancient mysterious archaeological atmosphere')
  },
  {
    id: 'base4',
    name: 'Base Set 2',
    era: 'base',
    prompt: createPrompt('Base Set 2', 'Blastoise Venusaur and Charizard standing together as iconic trio, vibrant blue green and red colors, classic legendary reunion atmosphere')
  },
  {
    id: 'base5',
    name: 'Team Rocket',
    era: 'base',
    prompt: createPrompt('Team Rocket', 'Dark Charizard with menacing red eyes in shadowy villain lair, dark purple black and red colors, villainous sinister dangerous atmosphere')
  },

  // ============================================
  // GYM SERIES (2000)
  // ============================================
  {
    id: 'gym1',
    name: 'Gym Heroes',
    era: 'gym',
    prompt: createPrompt('Gym Heroes', 'Blaine Arcanine and Lt Surge Electabuzz battling in Pokemon Gym arena, vibrant red and electric yellow colors, heroic competitive battle atmosphere')
  },
  {
    id: 'gym2',
    name: 'Gym Challenge',
    era: 'gym',
    prompt: createPrompt('Gym Challenge', 'Giovanni Nidoking facing Sabrina Alakazam in ultimate gym showdown, deep purple and psychic pink colors, intense championship challenge atmosphere')
  },

  // ============================================
  // NEO SERIES (2000-2002)
  // ============================================
  {
    id: 'neo1',
    name: 'Neo Genesis',
    era: 'neo',
    prompt: createPrompt('Neo Genesis', 'Lugia soaring majestically above silver ocean waves at dawn, silver white and ocean blue colors, new beginning genesis atmosphere')
  },
  {
    id: 'neo2',
    name: 'Neo Discovery',
    era: 'neo',
    prompt: createPrompt('Neo Discovery', 'Espeon and Umbreon in mystical ancient ruins with glowing symbols, purple and golden yellow colors, mysterious discovery exploration atmosphere')
  },
  {
    id: 'si1',
    name: 'Southern Islands',
    era: 'neo',
    prompt: createPrompt('Southern Islands', 'Mew floating peacefully over tropical paradise island beach with palm trees, pastel pink turquoise and sandy colors, serene tropical vacation atmosphere')
  },
  {
    id: 'neo3',
    name: 'Neo Revelation',
    era: 'neo',
    prompt: createPrompt('Neo Revelation', 'Ho-Oh descending from rainbow sky with sacred bells ringing, rainbow golden and crimson colors, divine revelation sacred atmosphere')
  },
  {
    id: 'neo4',
    name: 'Neo Destiny',
    era: 'neo',
    prompt: createPrompt('Neo Destiny', 'Shining Charizard with crystalline sparkle aura in cosmic space, shimmering holographic rainbow colors, ultimate destiny climactic atmosphere')
  },
  {
    id: 'lc',
    name: 'Legendary Collection',
    era: 'neo',
    prompt: createPrompt('Legendary Collection', 'Mewtwo Mew Articuno Zapdos Moltres legendary birds gathering in legendary hall, majestic blue red yellow and purple colors, legendary epic collection atmosphere')
  },

  // ============================================
  // E-CARD SERIES (2002-2003)
  // ============================================
  {
    id: 'ecard1',
    name: 'Expedition Base Set',
    era: 'ecard',
    prompt: createPrompt('Expedition', 'Feraligatr Typhlosion and Meganium starters exploring new frontier, vibrant blue red and green colors, expedition adventure exploration atmosphere')
  },
  {
    id: 'ecard2',
    name: 'Aquapolis',
    era: 'ecard',
    prompt: createPrompt('Aquapolis', 'Suicune running across crystal clear water in underwater city ruins, aqua blue crystal and teal colors, underwater ancient civilization atmosphere')
  },
  {
    id: 'ecard3',
    name: 'Skyridge',
    era: 'ecard',
    prompt: createPrompt('Skyridge', 'Celebi flying through floating sky islands with rainbows and clouds, sky blue green and rainbow colors, ethereal floating sky kingdom atmosphere')
  },

  // ============================================
  // EX SERIES (2003-2007)
  // ============================================
  {
    id: 'ex1',
    name: 'Ruby & Sapphire',
    era: 'ex',
    prompt: createPrompt('Ruby & Sapphire', 'Groudon and Kyogre facing each other with land and sea clash, ruby red and sapphire blue colors, elemental clash epic atmosphere')
  },
  {
    id: 'ex2',
    name: 'Sandstorm',
    era: 'ex',
    prompt: createPrompt('Sandstorm', 'Flygon soaring through desert sandstorm with ancient ruins below, sandy gold and brown desert colors, harsh desert sandstorm atmosphere')
  },
  {
    id: 'np',
    name: 'Nintendo Black Star Promos',
    era: 'ex',
    prompt: createPrompt('Nintendo Promos', 'Pikachu with Nintendo star badge surrounded by special promo aura, vibrant yellow and star gold colors, exclusive promotional special atmosphere')
  },
  {
    id: 'ex3',
    name: 'Dragon',
    era: 'ex',
    prompt: createPrompt('Dragon', 'Rayquaza coiling through thunderstorm clouds with dragon energy, emerald green and stormy gray colors, powerful dragon storm atmosphere')
  },
  {
    id: 'ex4',
    name: 'Team Magma vs Team Aqua',
    era: 'ex',
    prompt: createPrompt('Magma vs Aqua', 'Groudon facing Kyogre with Team Magma and Aqua forces clashing, magma red versus aqua blue colors, team war conflict battle atmosphere')
  },
  {
    id: 'ex5',
    name: 'Hidden Legends',
    era: 'ex',
    prompt: createPrompt('Hidden Legends', 'Regirock Regice Registeel standing as ancient golems in mysterious temple, rock ice and steel metallic colors, ancient hidden legendary secrets atmosphere')
  },
  {
    id: 'ex6',
    name: 'FireRed & LeafGreen',
    era: 'ex',
    prompt: createPrompt('FireRed LeafGreen', 'Charizard and Venusaur back to back in classic Kanto adventure, fire red and leaf green colors, nostalgic Kanto return adventure atmosphere')
  },
  {
    id: 'ex7',
    name: 'Team Rocket Returns',
    era: 'ex',
    prompt: createPrompt('Team Rocket Returns', 'Dark Tyranitar leading Team Rocket Pokemon army in darkness, dark purple and sinister black colors, villainous return revenge atmosphere')
  },
  {
    id: 'ex8',
    name: 'Deoxys',
    era: 'ex',
    prompt: createPrompt('Deoxys', 'Deoxys in all four forms with space DNA helix in cosmic background, cosmic purple and alien orange colors, extraterrestrial space virus atmosphere')
  },
  {
    id: 'ex9',
    name: 'Emerald',
    era: 'ex',
    prompt: createPrompt('Emerald', 'Rayquaza descending from Sky Pillar with emerald energy aura, brilliant emerald green colors, legendary sky dragon emerald atmosphere')
  },
  {
    id: 'ex10',
    name: 'Unseen Forces',
    era: 'ex',
    prompt: createPrompt('Unseen Forces', 'Entei Raikou Suicune legendary beasts running with mystical unseen energy, fire lightning and water colors, mystical unseen power forces atmosphere')
  },
  {
    id: 'ex11',
    name: 'Delta Species',
    era: 'ex',
    prompt: createPrompt('Delta Species', 'Delta Charizard with steel typing surrounded by delta transformation energy, metallic silver and altered colors, genetic mutation transformation atmosphere')
  },
  {
    id: 'ex12',
    name: 'Legend Maker',
    era: 'ex',
    prompt: createPrompt('Legend Maker', 'Mew creating legendary Pokemon with mythical creation energy, pink and golden creation colors, mythical legend creation atmosphere')
  },
  {
    id: 'ex13',
    name: 'Holon Phantoms',
    era: 'ex',
    prompt: createPrompt('Holon Phantoms', 'Ghost Holon Pokemon emerging from mysterious Holon research facility, ethereal phantom purple and holographic colors, mysterious phantom research atmosphere')
  },
  {
    id: 'ex14',
    name: 'Crystal Guardians',
    era: 'ex',
    prompt: createPrompt('Crystal Guardians', 'Crystal Jirachi and guardian Pokemon protecting crystal cave treasures, crystal clear and rainbow prismatic colors, crystal guardian protection atmosphere')
  },
  {
    id: 'ex15',
    name: 'Dragon Frontiers',
    era: 'ex',
    prompt: createPrompt('Dragon Frontiers', 'Salamence and Dragonite leading dragon army at frontier battle line, dragon blue and frontier orange colors, dragon war frontier battle atmosphere')
  },
  {
    id: 'ex16',
    name: 'Power Keepers',
    era: 'ex',
    prompt: createPrompt('Power Keepers', 'Absol and power keeper Pokemon guarding ancient power source, dark purple and power energy colors, ultimate power guardian atmosphere')
  },

  // ============================================
  // DIAMOND & PEARL SERIES (2007-2009)
  // ============================================
  {
    id: 'dp1',
    name: 'Diamond & Pearl',
    era: 'dp',
    prompt: createPrompt('Diamond & Pearl', 'Dialga and Palkia facing each other with time and space distortion, diamond blue and pearl pink colors, time space legendary clash atmosphere')
  },
  {
    id: 'dpp',
    name: 'DP Black Star Promos',
    era: 'dp',
    prompt: createPrompt('DP Promos', 'Darkrai emerging from nightmare shadows with promo star aura, nightmare black and red colors, exclusive dark promo atmosphere')
  },
  {
    id: 'dp2',
    name: 'Mysterious Treasures',
    era: 'dp',
    prompt: createPrompt('Mysterious Treasures', 'Azelf Mesprit Uxie lake guardians protecting mysterious treasures, lake blue and treasure gold colors, mysterious lake treasure atmosphere')
  },
  {
    id: 'dp3',
    name: 'Secret Wonders',
    era: 'dp',
    prompt: createPrompt('Secret Wonders', 'Gardevoir revealing secret wonders in mystical forest clearing, mystical purple and wonder pink colors, secret magical wonder atmosphere')
  },
  {
    id: 'dp4',
    name: 'Great Encounters',
    era: 'dp',
    prompt: createPrompt('Great Encounters', 'Cresselia and Darkrai in epic day versus night encounter, lunar pink and dark purple colors, great mythical encounter atmosphere')
  },
  {
    id: 'dp5',
    name: 'Majestic Dawn',
    era: 'dp',
    prompt: createPrompt('Majestic Dawn', 'Leafeon and Glaceon at majestic sunrise in Sinnoh meadow, dawn orange and nature green colors, majestic new dawn atmosphere')
  },
  {
    id: 'dp6',
    name: 'Legends Awakened',
    era: 'dp',
    prompt: createPrompt('Legends Awakened', 'Regigigas awakening with legendary titan energy surging, colossal white and ancient stone colors, legendary awakening power atmosphere')
  },
  {
    id: 'dp7',
    name: 'Stormfront',
    era: 'dp',
    prompt: createPrompt('Stormfront', 'Dusknoir summoning ghost storm front with lightning and spirits, stormy gray and ghost purple colors, supernatural storm front atmosphere')
  },

  // ============================================
  // PLATINUM SERIES (2009)
  // ============================================
  {
    id: 'pl1',
    name: 'Platinum',
    era: 'pl',
    prompt: createPrompt('Platinum', 'Giratina in Origin Forme emerging from Distortion World portal, platinum gray and distortion purple colors, distortion world chaos atmosphere')
  },
  {
    id: 'pl2',
    name: 'Rising Rivals',
    era: 'pl',
    prompt: createPrompt('Rising Rivals', 'Infernape and Empoleon as rival starters in heated battle, fire orange and water blue rivalry colors, intense rival competition atmosphere')
  },
  {
    id: 'pl3',
    name: 'Supreme Victors',
    era: 'pl',
    prompt: createPrompt('Supreme Victors', 'Rayquaza C and Garchomp C as supreme champion victors, champion gold and victory silver colors, supreme championship victory atmosphere')
  },
  {
    id: 'pl4',
    name: 'Arceus',
    era: 'pl',
    prompt: createPrompt('Arceus', 'Arceus the god Pokemon creating universe with multitype plates, divine white and multicolor type plates colors, divine creation god Pokemon atmosphere')
  },

  // ============================================
  // HEARTGOLD SOULSILVER SERIES (2010-2011)
  // ============================================
  {
    id: 'hgss1',
    name: 'HeartGold SoulSilver',
    era: 'hgss',
    prompt: createPrompt('HeartGold SoulSilver', 'Ho-Oh and Lugia reuniting over Johto region Bell Tower, heartgold and soulsilver colors, nostalgic Johto return atmosphere')
  },
  {
    id: 'hgssp',
    name: 'HGSS Black Star Promos',
    era: 'hgss',
    prompt: createPrompt('HGSS Promos', 'Pikachu with Johto starter Pokemon in promotional celebration, Johto starter colors with promo gold, HGSS special promotion atmosphere')
  },
  {
    id: 'hgss2',
    name: 'Unleashed',
    era: 'hgss',
    prompt: createPrompt('Unleashed', 'Entei Raikou Suicune legendary beasts unleashed running free, fire lightning and water beast colors, wild beasts unleashed freedom atmosphere')
  },
  {
    id: 'hgss3',
    name: 'Undaunted',
    era: 'hgss',
    prompt: createPrompt('Undaunted', 'Umbreon and Espeon standing undaunted against darkness, dark black and psychic purple colors, brave undaunted courage atmosphere')
  },
  {
    id: 'hgss4',
    name: 'Triumphant',
    era: 'hgss',
    prompt: createPrompt('Triumphant', 'Celebi triumphant with time travel victory celebration, forest green and triumph gold colors, triumphant final victory atmosphere')
  },
  {
    id: 'col1',
    name: 'Call of Legends',
    era: 'hgss',
    prompt: createPrompt('Call of Legends', 'Lugia Ho-Oh and legendary dogs answering the call of legends, legendary rainbow and epic colors, legendary call epic gathering atmosphere')
  },

  // ============================================
  // BLACK & WHITE SERIES (2011-2013)
  // ============================================
  {
    id: 'bw1',
    name: 'Black & White',
    era: 'bw',
    prompt: createPrompt('Black & White', 'Reshiram and Zekrom in yin yang balance with truth and ideals, pure white and deep black colors, truth ideals duality atmosphere')
  },
  {
    id: 'bwp',
    name: 'BW Black Star Promos',
    era: 'bw',
    prompt: createPrompt('BW Promos', 'Victini spreading victory wings with V-create fire, victory orange and fire red colors, victorious promo special atmosphere')
  },
  {
    id: 'bw2',
    name: 'Emerging Powers',
    era: 'bw',
    prompt: createPrompt('Emerging Powers', 'Thundurus Tornadus Landorus forces of nature emerging, storm cloud and force of nature colors, emerging nature forces atmosphere')
  },
  {
    id: 'bw3',
    name: 'Noble Victories',
    era: 'bw',
    prompt: createPrompt('Noble Victories', 'Victini leading noble Pokemon army to victory march, noble gold and victory red colors, noble victorious triumph atmosphere')
  },
  {
    id: 'bw4',
    name: 'Next Destinies',
    era: 'bw',
    prompt: createPrompt('Next Destinies', 'Mewtwo EX and destiny shaping legendary confrontation, destiny purple and psychic power colors, next destiny shaping atmosphere')
  },
  {
    id: 'bw5',
    name: 'Dark Explorers',
    era: 'bw',
    prompt: createPrompt('Dark Explorers', 'Darkrai leading dark exploration team through shadow ruins, dark black and explorer torch colors, dark mysterious exploration atmosphere')
  },
  {
    id: 'dv1',
    name: 'Dragon Vault',
    era: 'bw',
    prompt: createPrompt('Dragon Vault', 'Rayquaza guarding ancient dragon vault treasures, dragon green and vault gold colors, ancient dragon treasure vault atmosphere')
  },
  {
    id: 'bw6',
    name: 'Dragons Exalted',
    era: 'bw',
    prompt: createPrompt('Dragons Exalted', 'Rayquaza EX and dragon types exalted in dragon storm, exalted dragon colors, dragons exalted supreme atmosphere')
  },
  {
    id: 'bw7',
    name: 'Boundaries Crossed',
    era: 'bw',
    prompt: createPrompt('Boundaries Crossed', 'White Kyurem and Black Kyurem crossing fusion boundaries, ice white and electric black fusion colors, boundary crossing fusion atmosphere')
  },
  {
    id: 'bw8',
    name: 'Plasma Storm',
    era: 'bw',
    prompt: createPrompt('Plasma Storm', 'Team Plasma forces with Lugia and plasma energy storm, plasma blue and storm purple colors, Team Plasma storm assault atmosphere')
  },
  {
    id: 'bw9',
    name: 'Plasma Freeze',
    era: 'bw',
    prompt: createPrompt('Plasma Freeze', 'Kyurem freezing Team Plasma equipment in ice crystal prison, frozen blue and plasma ice colors, plasma freeze cold atmosphere')
  },
  {
    id: 'bw10',
    name: 'Plasma Blast',
    era: 'bw',
    prompt: createPrompt('Plasma Blast', 'Genesect blasting with plasma cannon in final Team Plasma battle, plasma purple and blast orange colors, plasma blast finale atmosphere')
  },
  {
    id: 'bw11',
    name: 'Legendary Treasures',
    era: 'bw',
    prompt: createPrompt('Legendary Treasures', 'all legendary Pokemon gathered with ultimate treasure hoard, legendary rainbow and treasure gold colors, legendary treasure finale atmosphere')
  },

  // ============================================
  // XY SERIES (2014-2016)
  // ============================================
  {
    id: 'xy1',
    name: 'XY',
    era: 'xy',
    prompt: createPrompt('XY', 'Xerneas and Yveltal as life and destruction facing each other, rainbow life and dark destruction colors, life death legendary clash atmosphere')
  },
  {
    id: 'xyp',
    name: 'XY Black Star Promos',
    era: 'xy',
    prompt: createPrompt('XY Promos', 'Pikachu EX with XY era promotional sparkle effects, electric yellow and promo gold colors, XY promotional special atmosphere')
  },
  {
    id: 'xy2',
    name: 'Flashfire',
    era: 'xy',
    prompt: createPrompt('Flashfire', 'Mega Charizard X and Y in blazing inferno flashfire, intense fire red and blue flame colors, mega evolution flashfire atmosphere')
  },
  {
    id: 'xy3',
    name: 'Furious Fists',
    era: 'xy',
    prompt: createPrompt('Furious Fists', 'Mega Lucario unleashing furious fighting aura fist barrage, fighting aura blue and fury red colors, furious fighting spirit atmosphere')
  },
  {
    id: 'xy4',
    name: 'Phantom Forces',
    era: 'xy',
    prompt: createPrompt('Phantom Forces', 'Mega Gengar commanding phantom ghost forces army, phantom purple and ghost shadow colors, phantom force haunting atmosphere')
  },
  {
    id: 'xy5',
    name: 'Primal Clash',
    era: 'xy',
    prompt: createPrompt('Primal Clash', 'Primal Groudon and Primal Kyogre in ancient primal clash, primal red and primal blue ancient colors, primal ancient power clash atmosphere')
  },
  {
    id: 'xy6',
    name: 'Roaring Skies',
    era: 'xy',
    prompt: createPrompt('Roaring Skies', 'Mega Rayquaza soaring through roaring sky heavens, sky emerald and cloud white colors, roaring sky dragon flight atmosphere')
  },
  {
    id: 'xy7',
    name: 'Ancient Origins',
    era: 'xy',
    prompt: createPrompt('Ancient Origins', 'Hoopa Unbound opening portals to ancient origin dimensions, ancient gold and portal purple colors, ancient dimensional origin atmosphere')
  },
  {
    id: 'xy8',
    name: 'BREAKthrough',
    era: 'xy',
    prompt: createPrompt('BREAKthrough', 'BREAK evolution Pokemon shattering through golden barriers, breakthrough gold and shatter effect colors, breakthrough evolution power atmosphere')
  },
  {
    id: 'xy9',
    name: 'BREAKpoint',
    era: 'xy',
    prompt: createPrompt('BREAKpoint', 'Greninja BREAK and Gyarados at the breakpoint climax, breakpoint blue and intense red colors, critical breakpoint moment atmosphere')
  },
  {
    id: 'g1',
    name: 'Generations',
    era: 'xy',
    prompt: createPrompt('Generations', 'all generation starters celebrating Pokemon 20th anniversary, celebratory rainbow and nostalgic colors, generations celebration anniversary atmosphere')
  },
  {
    id: 'xy10',
    name: 'Fates Collide',
    era: 'xy',
    prompt: createPrompt('Fates Collide', 'Zygarde Complete Form as fates collide in epic confrontation, fate green and collision energy colors, fate collision destiny atmosphere')
  },
  {
    id: 'xy11',
    name: 'Steam Siege',
    era: 'xy',
    prompt: createPrompt('Steam Siege', 'Volcanion steam siege with magearna in steampunk fortress, steam white and siege fire colors, steam powered siege atmosphere')
  },
  {
    id: 'xy12',
    name: 'Evolutions',
    era: 'xy',
    prompt: createPrompt('Evolutions', 'original Charizard Blastoise Venusaur in nostalgic evolution remake, classic nostalgic original colors, nostalgic evolution tribute atmosphere')
  },

  // ============================================
  // SUN & MOON SERIES (2017-2019)
  // ============================================
  {
    id: 'sm1',
    name: 'Sun & Moon',
    era: 'sm',
    prompt: createPrompt('Sun & Moon', 'Solgaleo and Lunala as sun and moon facing each other in Alola, solar gold and lunar purple colors, tropical Alola sun moon atmosphere')
  },
  {
    id: 'smp',
    name: 'SM Black Star Promos',
    era: 'sm',
    prompt: createPrompt('SM Promos', 'Alolan Raichu surfing with promotional Alola celebration, electric yellow and tropical colors, Alola promo celebration atmosphere')
  },
  {
    id: 'sm2',
    name: 'Guardians Rising',
    era: 'sm',
    prompt: createPrompt('Guardians Rising', 'Tapu Koko Tapu Lele Tapu Bulu Tapu Fini guardians rising together, guardian elemental island colors, island guardians rising atmosphere')
  },
  {
    id: 'sm3',
    name: 'Burning Shadows',
    era: 'sm',
    prompt: createPrompt('Burning Shadows', 'Necrozma casting burning shadows over Ultra dimension, burning orange and shadow black colors, ominous burning shadow atmosphere')
  },
  {
    id: 'sm35',
    name: 'Shining Legends',
    era: 'sm',
    prompt: createPrompt('Shining Legends', 'Shining Mew and shining Pokemon with legendary sparkle aura, shining holographic rainbow colors, shining legendary sparkle atmosphere')
  },
  {
    id: 'sm4',
    name: 'Crimson Invasion',
    era: 'sm',
    prompt: createPrompt('Crimson Invasion', 'Ultra Beast invasion with Buzzwole and Pheromosa from Ultra Space, crimson red and alien invasion colors, crimson Ultra Beast invasion atmosphere')
  },
  {
    id: 'sm5',
    name: 'Ultra Prism',
    era: 'sm',
    prompt: createPrompt('Ultra Prism', 'Dusk Mane and Dawn Wings Necrozma with ultra prism light, prism rainbow and ultra light colors, ultra prism dimensional atmosphere')
  },
  {
    id: 'sm6',
    name: 'Forbidden Light',
    era: 'sm',
    prompt: createPrompt('Forbidden Light', 'Ultra Necrozma unleashing forbidden light energy blast, forbidden gold and light ray colors, forbidden ultimate light atmosphere')
  },
  {
    id: 'sm7',
    name: 'Celestial Storm',
    era: 'sm',
    prompt: createPrompt('Celestial Storm', 'Rayquaza GX in celestial meteor storm from space, celestial blue and storm meteor colors, celestial cosmic storm atmosphere')
  },
  {
    id: 'sm75',
    name: 'Dragon Majesty',
    era: 'sm',
    prompt: createPrompt('Dragon Majesty', 'all dragon type Pokemon in majestic dragon gathering, dragon majestic rainbow colors, dragon type majesty atmosphere')
  },
  {
    id: 'sm8',
    name: 'Lost Thunder',
    era: 'sm',
    prompt: createPrompt('Lost Thunder', 'Zeraora unleashing lost thunder lightning in storm, electric yellow and thunder storm colors, lost thunder electric atmosphere')
  },
  {
    id: 'sm9',
    name: 'Team Up',
    era: 'sm',
    prompt: createPrompt('Team Up', 'Pikachu and Zekrom tag team in ultimate team up, electric team blue and yellow colors, tag team partnership atmosphere')
  },
  {
    id: 'det1',
    name: 'Detective Pikachu',
    era: 'sm',
    prompt: createPrompt('Detective Pikachu', 'Detective Pikachu in noir mystery city investigation scene, noir detective and neon city colors, detective mystery investigation atmosphere')
  },
  {
    id: 'sm10',
    name: 'Unbroken Bonds',
    era: 'sm',
    prompt: createPrompt('Unbroken Bonds', 'Reshiram and Charizard GX in unbroken bond partnership, fire bond orange and friendship colors, unbroken partnership bond atmosphere')
  },
  {
    id: 'sm11',
    name: 'Unified Minds',
    era: 'sm',
    prompt: createPrompt('Unified Minds', 'Mewtwo and Mew GX with unified psychic minds connection, psychic purple and mind link colors, unified minds psychic atmosphere')
  },
  {
    id: 'sm115',
    name: 'Hidden Fates',
    era: 'sm',
    prompt: createPrompt('Hidden Fates', 'Shiny Charizard with hidden fates shiny vault treasures, shiny alternate and hidden gold colors, hidden shiny fates atmosphere')
  },
  {
    id: 'sm12',
    name: 'Cosmic Eclipse',
    era: 'sm',
    prompt: createPrompt('Cosmic Eclipse', 'Arceus Dialga Palkia GX in cosmic eclipse finale, cosmic eclipse purple and space colors, cosmic eclipse finale atmosphere')
  },

  // ============================================
  // SWORD & SHIELD SERIES (2020-2023)
  // ============================================
  {
    id: 'swshp',
    name: 'SWSH Black Star Promos',
    era: 'swsh',
    prompt: createPrompt('SWSH Promos', 'Pikachu V with Galar crown promotional celebration, promo gold and Galar purple colors, Galar promo celebration atmosphere')
  },
  {
    id: 'swsh1',
    name: 'Sword & Shield',
    era: 'swsh',
    prompt: createPrompt('Sword & Shield', 'Zacian and Zamazenta legendary wolves of Galar facing each other, sword blue and shield red colors, Galar legendary wolves atmosphere')
  },
  {
    id: 'swsh2',
    name: 'Rebel Clash',
    era: 'swsh',
    prompt: createPrompt('Rebel Clash', 'Gigantamax Pokemon in rebel clash stadium battle, dynamax red and rebel energy colors, rebel gigantamax clash atmosphere')
  },
  {
    id: 'swsh3',
    name: 'Darkness Ablaze',
    era: 'swsh',
    prompt: createPrompt('Darkness Ablaze', 'Eternatus VMAX spreading darkness ablaze across Galar, darkness purple and ablaze red colors, darkness ablaze menace atmosphere')
  },
  {
    id: 'swsh35',
    name: "Champion's Path",
    era: 'swsh',
    prompt: createPrompt("Champion's Path", 'Charizard VMAX on champion path to glory, champion gold and path fire colors, champion glory path atmosphere')
  },
  {
    id: 'swsh4',
    name: 'Vivid Voltage',
    era: 'swsh',
    prompt: createPrompt('Vivid Voltage', 'Pikachu VMAX with vivid voltage amazing rare energy, vivid electric and voltage colors, vivid voltage electric atmosphere')
  },
  {
    id: 'swsh45',
    name: 'Shining Fates',
    era: 'swsh',
    prompt: createPrompt('Shining Fates', 'Shiny Charizard VMAX with shining fates shiny vault, shiny black and fates sparkle colors, shining fates shiny atmosphere')
  },
  {
    id: 'swsh5',
    name: 'Battle Styles',
    era: 'swsh',
    prompt: createPrompt('Battle Styles', 'Urshifu Single Strike and Rapid Strike in martial arts duel, strike red and rapid blue colors, battle styles martial atmosphere')
  },
  {
    id: 'swsh6',
    name: 'Chilling Reign',
    era: 'swsh',
    prompt: createPrompt('Chilling Reign', 'Calyrex Ice Rider and Shadow Rider in chilling reign, ice blue and shadow purple reign colors, chilling royal reign atmosphere')
  },
  {
    id: 'swsh7',
    name: 'Evolving Skies',
    era: 'swsh',
    prompt: createPrompt('Evolving Skies', 'all Eeveelutions in evolving skies rainbow celebration, evolving rainbow sky colors, evolving eeveelution sky atmosphere')
  },
  {
    id: 'cel25',
    name: 'Celebrations',
    era: 'swsh',
    prompt: createPrompt('Celebrations', 'Pikachu with 25th anniversary golden celebration balloons, celebration gold and anniversary colors, 25th anniversary celebration atmosphere')
  },
  {
    id: 'swsh8',
    name: 'Fusion Strike',
    era: 'swsh',
    prompt: createPrompt('Fusion Strike', 'Mew VMAX with fusion strike energy combination power, fusion pink and strike energy colors, fusion strike power atmosphere')
  },
  {
    id: 'swsh9',
    name: 'Brilliant Stars',
    era: 'swsh',
    prompt: createPrompt('Brilliant Stars', 'Arceus VSTAR shining with brilliant stars cosmic power, brilliant star white and cosmic colors, brilliant stars divine atmosphere')
  },
  {
    id: 'swsh10',
    name: 'Astral Radiance',
    era: 'swsh',
    prompt: createPrompt('Astral Radiance', 'Origin Dialga and Palkia VSTAR in astral radiance dimension, astral blue and radiance pink colors, astral radiance Hisui atmosphere')
  },
  {
    id: 'swsh105',
    name: 'Pokemon GO',
    era: 'swsh',
    prompt: createPrompt('Pokemon GO', 'Mewtwo VSTAR with Pokemon GO augmented reality effects, Pokemon GO blue and AR digital colors, Pokemon GO mobile adventure atmosphere')
  },
  {
    id: 'swsh11',
    name: 'Lost Origin',
    era: 'swsh',
    prompt: createPrompt('Lost Origin', 'Giratina VSTAR emerging from lost origin dimension portal, lost zone purple and origin distortion colors, lost origin dimension atmosphere')
  },
  {
    id: 'swsh12',
    name: 'Silver Tempest',
    era: 'swsh',
    prompt: createPrompt('Silver Tempest', 'Lugia VSTAR in silver tempest ocean storm, silver storm and tempest ocean colors, silver tempest storm atmosphere')
  },
  {
    id: 'swsh125',
    name: 'Crown Zenith',
    era: 'swsh',
    prompt: createPrompt('Crown Zenith', 'Zacian Zamazenta Eternatus at crown zenith peak, crown gold and zenith royal colors, crown zenith finale atmosphere')
  },

  // ============================================
  // SCARLET & VIOLET SERIES (2023-present)
  // ============================================
  {
    id: 'svp',
    name: 'SVP Black Star Promos',
    era: 'sv',
    prompt: createPrompt('SV Promos', 'Pikachu ex with Paldea promotional celebration, promo gold and Paldea colors, Paldea promo celebration atmosphere')
  },
  {
    id: 'sv01',
    name: 'Scarlet & Violet',
    era: 'sv',
    prompt: createPrompt('Scarlet & Violet', 'Koraidon and Miraidon legendary past and future facing each other, scarlet red and violet purple colors, past future Paldea adventure atmosphere')
  },
  {
    id: 'sv02',
    name: 'Paldea Evolved',
    era: 'sv',
    prompt: createPrompt('Paldea Evolved', 'Paldean evolved Pokemon in Paldea region landscape, evolved nature and Paldea colors, Paldea evolution adventure atmosphere')
  },
  {
    id: 'sv03',
    name: 'Obsidian Flames',
    era: 'sv',
    prompt: createPrompt('Obsidian Flames', 'Charizard ex Tera Dark in obsidian flames eruption, obsidian black and flame orange colors, obsidian flames dark fire atmosphere')
  },
  {
    id: 'sv035',
    name: '151',
    era: 'sv',
    prompt: createPrompt('151', 'original 151 Kanto Pokemon with Mew in nostalgic celebration, classic Kanto nostalgic colors, original 151 nostalgia atmosphere')
  },
  {
    id: 'sv04',
    name: 'Paradox Rift',
    era: 'sv',
    prompt: createPrompt('Paradox Rift', 'Roaring Moon and Iron Valiant paradox Pokemon in time rift, paradox purple and rift energy colors, paradox time rift atmosphere')
  },
  {
    id: 'sv045',
    name: 'Paldean Fates',
    era: 'sv',
    prompt: createPrompt('Paldean Fates', 'Shiny Charizard ex with Paldean fates shiny treasure, shiny alternate and fates sparkle colors, Paldean shiny fates atmosphere')
  },
  {
    id: 'sv05',
    name: 'Temporal Forces',
    era: 'sv',
    prompt: createPrompt('Temporal Forces', 'Walking Wake and Iron Leaves with temporal force energy, temporal blue and force green colors, temporal paradox forces atmosphere')
  },
  {
    id: 'sv06',
    name: 'Twilight Masquerade',
    era: 'sv',
    prompt: createPrompt('Twilight Masquerade', 'Ogerpon masks in twilight masquerade festival celebration, twilight purple and masquerade mask colors, twilight festival masquerade atmosphere')
  },
  {
    id: 'sv065',
    name: 'Shrouded Fable',
    era: 'sv',
    prompt: createPrompt('Shrouded Fable', 'Pecharunt in shrouded fable dark fairy tale scene, shrouded dark and fable mystical colors, dark fairy tale shrouded atmosphere')
  },
  {
    id: 'sv07',
    name: 'Stellar Crown',
    era: 'sv',
    prompt: createPrompt('Stellar Crown', 'Terapagos Stellar Form with stellar crown cosmic power, stellar rainbow and crown cosmic colors, stellar crown cosmic atmosphere')
  },
  {
    id: 'sv08',
    name: 'Surging Sparks',
    era: 'sv',
    prompt: createPrompt('Surging Sparks', 'Pikachu ex with surging sparks electric storm power, surging yellow and electric spark colors, surging electric sparks atmosphere')
  },
  {
    id: 'sv085',
    name: 'Prismatic Evolutions',
    era: 'sv',
    prompt: createPrompt('Prismatic Evolutions', 'all Eeveelutions in prismatic evolutions rainbow celebration, prismatic rainbow evolution colors, prismatic eeveelution celebration atmosphere')
  },
  {
    id: 'sv09',
    name: 'Journey Together',
    era: 'sv',
    prompt: createPrompt('Journey Together', 'trainer and Pokemon partnership journey together adventure, journey warm and together friendship colors, journey partnership adventure atmosphere')
  },
  {
    id: 'sv10',
    name: 'Destined Rivals',
    era: 'sv',
    prompt: createPrompt('Destined Rivals', 'rival Pokemon facing each other in destined rivalry battle, rivalry intense and destiny colors, destined rivalry confrontation atmosphere')
  },

  // ============================================
  // POKEMON CARD GAME POCKET (2024-present)
  // ============================================
  {
    id: 'A1',
    name: 'Genetic Apex',
    era: 'pocket',
    prompt: createPrompt('Genetic Apex', 'Mewtwo Charizard Pikachu at genetic apex peak power, genetic purple and apex gold colors, genetic apex ultimate atmosphere')
  },
  {
    id: 'P-A',
    name: 'Promos-A',
    era: 'pocket',
    prompt: createPrompt('Pocket Promos', 'Pikachu with Pocket game promotional celebration effects, promo gold and pocket game colors, Pocket promo special atmosphere')
  },
  {
    id: 'A1a',
    name: 'Mythical Island',
    era: 'pocket',
    prompt: createPrompt('Mythical Island', 'Mew floating over mythical tropical island paradise, mythical pink and island tropical colors, mythical island paradise atmosphere')
  },
  {
    id: 'A2',
    name: 'Space-Time Smackdown',
    era: 'pocket',
    prompt: createPrompt('Space-Time Smackdown', 'Dialga and Palkia in space-time smackdown collision, space blue and time pink smackdown colors, space-time collision smackdown atmosphere')
  },
  {
    id: 'A2a',
    name: 'Triumphant Light',
    era: 'pocket',
    prompt: createPrompt('Triumphant Light', 'Arceus radiating triumphant light divine power, triumphant gold and divine light colors, triumphant divine light atmosphere')
  },
  {
    id: 'A3',
    name: 'Celestial Guardians',
    era: 'pocket',
    prompt: createPrompt('Celestial Guardians', 'Solgaleo and Lunala as celestial guardians of sky, celestial gold and guardian silver colors, celestial guardian protection atmosphere')
  },

  // ============================================
  // MEGA EVOLUTION SERIES (2024-present)
  // ============================================
  {
    id: 'me01',
    name: 'Mega Evolution',
    era: 'me',
    prompt: createPrompt('Mega Evolution', 'Mega Rayquaza with mega evolution transformation energy, mega rainbow evolution colors, mega evolution power atmosphere')
  },
  {
    id: 'me02',
    name: 'Phantasmal Flames',
    era: 'me',
    prompt: createPrompt('Phantasmal Flames', 'Mega Gengar with phantasmal ghost flames surrounding, phantasmal purple and ghost flame colors, phantasmal ghost flames atmosphere')
  },

  // ============================================
  // POP SERIES (2004-2009)
  // ============================================
  {
    id: 'pop1',
    name: 'POP Series 1',
    era: 'pop',
    prompt: createPrompt('POP Series 1', 'Pikachu and Eevee with POP tournament trophy celebration, vibrant tournament gold colors, competitive tournament celebration atmosphere')
  },
  {
    id: 'pop2',
    name: 'POP Series 2',
    era: 'pop',
    prompt: createPrompt('POP Series 2', 'Celebi with POP series special holofoil sparkle effects, green and holofoil shimmer colors, organized play special atmosphere')
  },
  {
    id: 'pop3',
    name: 'POP Series 3',
    era: 'pop',
    prompt: createPrompt('POP Series 3', 'Jolteon Flareon Vaporeon eeveelutions in POP competition, electric fire and water colors, competitive eeveelution showdown atmosphere')
  },
  {
    id: 'pop4',
    name: 'POP Series 4',
    era: 'pop',
    prompt: createPrompt('POP Series 4', 'Deoxys transforming between forms in POP showcase, cosmic purple transformation colors, organized play transformation atmosphere')
  },
  {
    id: 'pop5',
    name: 'POP Series 5',
    era: 'pop',
    prompt: createPrompt('POP Series 5', 'Mew and Lucario in POP series championship battle, pink and aura blue colors, championship battle atmosphere')
  },
  {
    id: 'pop6',
    name: 'POP Series 6',
    era: 'pop',
    prompt: createPrompt('POP Series 6', 'Pachirisu and Lucario in Diamond Pearl POP era, electric blue and fighting aura colors, Sinnoh POP tournament atmosphere')
  },
  {
    id: 'pop7',
    name: 'POP Series 7',
    era: 'pop',
    prompt: createPrompt('POP Series 7', 'Gallade and Gardevoir in elegant POP competition dance, psychic purple and fighting green colors, elegant competitive display atmosphere')
  },
  {
    id: 'pop8',
    name: 'POP Series 8',
    era: 'pop',
    prompt: createPrompt('POP Series 8', 'Heatran in volcanic POP championship arena, lava red and steel gray colors, volcanic tournament heat atmosphere')
  },
  {
    id: 'pop9',
    name: 'POP Series 9',
    era: 'pop',
    prompt: createPrompt('POP Series 9', 'Rotom in all appliance forms for final POP series, electric orange and ghost purple colors, mischievous final series atmosphere')
  },

  // ============================================
  // McDONALD'S COLLECTIONS
  // ============================================
  {
    id: '2011bw',
    name: "McDonald's Collection 2011",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2011", 'Pikachu with McDonalds happy meal toys BW era, McDonalds red yellow and BW colors, McDonalds happy promo atmosphere')
  },
  {
    id: '2012bw',
    name: "McDonald's Collection 2012",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2012", 'Oshawott Tepig Snivy with McDonalds 2012 celebration, McDonalds red and Unova starter colors, McDonalds Unova starter atmosphere')
  },
  {
    id: '2014xy',
    name: "McDonald's Collection 2014",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2014", 'Chespin Fennekin Froakie with McDonalds 2014 happy meal, McDonalds red and Kalos starter colors, McDonalds Kalos starter atmosphere')
  },
  {
    id: '2015xy',
    name: "McDonald's Collection 2015",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2015", 'Hoopa with McDonalds 2015 movie promotion, McDonalds red and Hoopa purple colors, McDonalds movie promo atmosphere')
  },
  {
    id: '2016xy',
    name: "McDonald's Collection 2016",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2016", 'Pikachu celebrating with McDonalds 2016 toys, McDonalds red yellow celebration colors, McDonalds celebration atmosphere')
  },
  {
    id: '2017sm',
    name: "McDonald's Collection 2017",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2017", 'Rowlet Litten Popplio with McDonalds 2017 Alola promotion, McDonalds red and Alola starter colors, McDonalds Alola starter atmosphere')
  },
  {
    id: '2018sm',
    name: "McDonald's Collection 2018",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2018", 'Alolan forms with McDonalds 2018 tropical theme, McDonalds red and tropical Alola colors, McDonalds tropical Alola atmosphere')
  },
  {
    id: '2019sm',
    name: "McDonald's Collection 2019",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2019", 'Detective Pikachu with McDonalds 2019 movie celebration, McDonalds red and detective hat colors, McDonalds detective movie atmosphere')
  },
  {
    id: '2021swsh',
    name: "McDonald's Collection 2021",
    era: 'mcd',
    prompt: createPrompt("McDonald's 2021", 'Pikachu with McDonalds 25th anniversary 2021 celebration, McDonalds red and 25th gold colors, McDonalds 25th anniversary atmosphere')
  },

  // ============================================
  // POKEMON POCKET - ADDITIONAL SETS
  // ============================================
  {
    id: 'A2b',
    name: 'Shining Revelry',
    era: 'pocket',
    prompt: createPrompt('Shining Revelry', 'shiny Pokemon in shining revelry celebration party, shining sparkle and revelry festive colors, shining revelry celebration atmosphere')
  },
  {
    id: 'A3a',
    name: 'Extradimensional Crisis',
    era: 'pocket',
    prompt: createPrompt('Extradimensional Crisis', 'Ultra Beasts in extradimensional crisis invasion, extradimensional purple and crisis red colors, extradimensional crisis atmosphere')
  },
  {
    id: 'A3b',
    name: 'Eevee Grove',
    era: 'pocket',
    prompt: createPrompt('Eevee Grove', 'Eevee and eeveelutions playing in peaceful grove, grove green and eevee warm colors, peaceful Eevee grove atmosphere')
  },
  {
    id: 'A4',
    name: 'Wisdom of Sea and Sky',
    era: 'pocket',
    prompt: createPrompt('Wisdom of Sea and Sky', 'Kyogre and Rayquaza with wisdom of sea and sky, sea blue and sky emerald colors, sea sky wisdom atmosphere')
  },
  {
    id: 'A4a',
    name: 'Secluded Springs',
    era: 'pocket',
    prompt: createPrompt('Secluded Springs', 'water Pokemon in peaceful secluded hot springs retreat, spring water blue and secluded tranquil colors, secluded springs peaceful atmosphere')
  },
  {
    id: 'B1',
    name: 'Mega Rising',
    era: 'pocket',
    prompt: createPrompt('Mega Rising', 'multiple Mega Pokemon rising with mega evolution energy, mega rising rainbow evolution colors, mega rising power atmosphere')
  },

  // ============================================
  // SPECIAL SETS & SUBSETS
  // ============================================
  {
    id: 'dc1',
    name: 'Double Crisis',
    era: 'xy',
    prompt: createPrompt('Double Crisis', 'Team Magma Groudon versus Team Aqua Kyogre double crisis, magma red versus aqua blue crisis colors, double team crisis atmosphere')
  },
  {
    id: 'rc',
    name: 'Radiant Collection',
    era: 'bw',
    prompt: createPrompt('Radiant Collection', 'cute Pokemon like Pikachu Eevee in radiant sparkling scene, radiant pastel and sparkle colors, radiant cute collection atmosphere')
  },
  {
    id: 'xy0',
    name: 'Kalos Starter Set',
    era: 'xy',
    prompt: createPrompt('Kalos Starter Set', 'Chespin Fennekin Froakie Kalos starters beginning adventure, grass fire water starter colors, new Kalos adventure beginning atmosphere')
  },
  {
    id: 'ru1',
    name: 'Pokemon Rumble',
    era: 'pl',
    prompt: createPrompt('Pokemon Rumble', 'Toy Pikachu and Rumble Pokemon in windup toy world, toy plastic bright colors, playful toy rumble battle atmosphere')
  },
  {
    id: 'fut2020',
    name: 'Pokemon Futsal 2020',
    era: 'special',
    prompt: createPrompt('Pokemon Futsal', 'Pikachu playing futsal soccer with Pokemon team, futsal green field and team colors, Pokemon futsal soccer atmosphere')
  },
  {
    id: 'mep',
    name: 'MEP Black Star Promos',
    era: 'me',
    prompt: createPrompt('MEP Promos', 'Mega Charizard X with MEP promotional celebration, mega promo gold and blue fire colors, mega promo special atmosphere')
  },

  // ============================================
  // TRAINER KITS & SPECIAL PRODUCTS
  // ============================================
  {
    id: 'jumbo',
    name: 'Jumbo cards',
    era: 'special',
    prompt: createPrompt('Jumbo Cards', 'oversized jumbo Pikachu display card showcase, jumbo showcase gold colors, jumbo special display atmosphere')
  },
  {
    id: 'wp',
    name: 'W Promotional',
    era: 'base',
    prompt: createPrompt('W Promos', 'Wizards era promotional Pokemon with vintage W stamp, vintage promo and W stamp colors, vintage Wizards promo atmosphere')
  },
  {
    id: 'sp',
    name: 'Sample',
    era: 'special',
    prompt: createPrompt('Sample Cards', 'sample card template with Pokemon showcase display, sample display neutral colors, sample showcase display atmosphere')
  },
  {
    id: 'bog',
    name: 'Best of game',
    era: 'special',
    prompt: createPrompt('Best of Game', 'best Pokemon cards from all eras in trophy showcase, best of gold and trophy colors, best of game trophy atmosphere')
  },

  // ============================================
  // SUBSET EXPANSIONS (with decimal IDs)
  // ============================================
  {
    id: 'sv10.5b',
    name: 'Black Bolt',
    era: 'sv',
    prompt: createPrompt('Black Bolt', 'Zekrom unleashing black bolt lightning in dark storm, black bolt electric and dark colors, black bolt power atmosphere')
  },
  {
    id: 'sv10.5w',
    name: 'White Flare',
    era: 'sv',
    prompt: createPrompt('White Flare', 'Reshiram unleashing white flare flames in bright sky, white flare fire and bright colors, white flare power atmosphere')
  },

  // ============================================
  // TRAINER KITS - Generic banners by era
  // ============================================
  {
    id: 'tk-ex-latia',
    name: 'EX Trainer Kit Latias',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Latias', 'Latias flying gracefully in trainer kit tutorial setting, Latias red and trainer kit colors, trainer kit learning atmosphere')
  },
  {
    id: 'tk-ex-latio',
    name: 'EX Trainer Kit Latios',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Latios', 'Latios soaring powerfully in trainer kit tutorial setting, Latios blue and trainer kit colors, trainer kit learning atmosphere')
  },
  {
    id: 'tk-ex-m',
    name: 'EX Trainer Kit Plusle Minun',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Plusle Minun', 'Plusle and Minun cheering together in trainer kit, electric yellow and red colors, trainer kit cheerful atmosphere')
  },
  {
    id: 'tk-ex-p',
    name: 'EX Trainer Kit Pikachu',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Pikachu', 'Pikachu teaching Pokemon TCG basics in trainer kit, electric yellow and tutorial colors, trainer kit Pikachu learning atmosphere')
  },
  {
    id: 'tk-dp-l',
    name: 'DP Trainer Kit Lucario',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Lucario', 'Lucario demonstrating aura power in trainer kit setting, aura blue and trainer kit colors, trainer kit Lucario atmosphere')
  },
  {
    id: 'tk-dp-m',
    name: 'DP Trainer Kit Manaphy',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Manaphy', 'Manaphy swimming happily in trainer kit ocean setting, ocean blue and trainer kit colors, trainer kit Manaphy atmosphere')
  },
  {
    id: 'tk-hs-g',
    name: 'HGSS Trainer Kit Gyarados',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Gyarados', 'Gyarados emerging powerfully in trainer kit setting, water blue and trainer kit colors, trainer kit Gyarados atmosphere')
  },
  {
    id: 'tk-hs-r',
    name: 'HGSS Trainer Kit Raichu',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Raichu', 'Raichu sparking electricity in trainer kit setting, electric orange and trainer kit colors, trainer kit Raichu atmosphere')
  },
  {
    id: 'tk-bw-e',
    name: 'BW Trainer Kit Excadrill',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Excadrill', 'Excadrill drilling through ground in trainer kit setting, ground brown and trainer kit colors, trainer kit Excadrill atmosphere')
  },
  {
    id: 'tk-bw-z',
    name: 'BW Trainer Kit Zoroark',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Zoroark', 'Zoroark using illusion in trainer kit setting, dark red and trainer kit colors, trainer kit Zoroark atmosphere')
  },
  {
    id: 'tk-xy-b',
    name: 'XY Trainer Kit Bisharp',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Bisharp', 'Bisharp standing ready in trainer kit setting, steel dark and trainer kit colors, trainer kit Bisharp atmosphere')
  },
  {
    id: 'tk-xy-latia',
    name: 'XY Trainer Kit Latias',
    era: 'tk',
    prompt: createPrompt('XY Trainer Kit Latias', 'Latias flying in XY era trainer kit setting, Latias red and XY trainer kit colors, XY trainer kit Latias atmosphere')
  },
  {
    id: 'tk-xy-latio',
    name: 'XY Trainer Kit Latios',
    era: 'tk',
    prompt: createPrompt('XY Trainer Kit Latios', 'Latios soaring in XY era trainer kit setting, Latios blue and XY trainer kit colors, XY trainer kit Latios atmosphere')
  },
  {
    id: 'tk-xy-n',
    name: 'XY Trainer Kit Noivern',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Noivern', 'Noivern screeching in trainer kit setting, dragon purple and trainer kit colors, trainer kit Noivern atmosphere')
  },
  {
    id: 'tk-xy-p',
    name: 'XY Trainer Kit Pikachu Libre',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Pikachu Libre', 'Pikachu Libre wrestling in trainer kit setting, electric yellow and libre costume colors, trainer kit Pikachu Libre atmosphere')
  },
  {
    id: 'tk-xy-su',
    name: 'XY Trainer Kit Suicune',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Suicune', 'Suicune running gracefully in trainer kit setting, water blue and aurora colors, trainer kit Suicune atmosphere')
  },
  {
    id: 'tk-xy-sy',
    name: 'XY Trainer Kit Sylveon',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Sylveon', 'Sylveon with ribbons in trainer kit setting, fairy pink and trainer kit colors, trainer kit Sylveon atmosphere')
  },
  {
    id: 'tk-xy-w',
    name: 'XY Trainer Kit Wigglytuff',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Wigglytuff', 'Wigglytuff singing in trainer kit setting, fairy pink and trainer kit colors, trainer kit Wigglytuff atmosphere')
  },
  {
    id: 'tk-sm-l',
    name: 'SM Trainer Kit Lycanroc',
    era: 'tk',
    prompt: createPrompt('Trainer Kit Lycanroc', 'Lycanroc howling in Alola trainer kit setting, rock brown and Alola colors, trainer kit Lycanroc atmosphere')
  },
  {
    id: 'tk-sm-r',
    name: 'SM Trainer Kit Raichu',
    era: 'tk',
    prompt: createPrompt('SM Trainer Kit Raichu', 'Alolan Raichu surfing in trainer kit setting, electric yellow and psychic pink colors, trainer kit Alolan Raichu atmosphere')
  }
]

// Export count for reference
export const TOTAL_PROMPTS = POKEMON_SET_PROMPTS.length
