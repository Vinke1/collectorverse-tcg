export type Language = 'fr' | 'en' | 'jp' | 'zh';

export const translations = {
  fr: {
    nav: {
      home: "Accueil",
      pokemon: "Pokémon",
      lorcana: "Lorcana",
      onepiece: "One Piece",
      riftbound: "Riftbound",
      naruto: "Naruto",
      starwars: "Star Wars",
      login: "Connexion",
      logout: "Se déconnecter",
      menu: "Menu"
    },
    home: {
      hero: {
        explore: "Explorez",
        platform: "La plateforme ultime pour les collectionneurs. Gérez, suivez et complétez vos collections de cartes à travers tous les univers."
      },
      tcg: {
        pokemon: {
          desc: "Attrapez-les tous",
          stats: "1000+ cartes"
        },
        lorcana: {
          desc: "L'univers magique Disney",
          stats: "500+ cartes"
        },
        onepiece: {
          desc: "L'ère de la piraterie",
          stats: "700+ cartes"
        },
        riftbound: {
          desc: "Légendes tactiques",
          stats: "400+ cartes"
        },
        naruto: {
          desc: "La voie du Ninja",
          stats: "300+ cartes"
        },
        starwars: {
          desc: "La galaxie lointaine",
          stats: "3000+ cartes"
        }
      }
    },
    series: {
      page: {
        title: "Séries",
        subtitle: "Découvrez toutes les séries disponibles"
      },
      grid: {
        empty: "Aucune série disponible pour le moment.",
        coming_soon: "Les séries seront ajoutées prochainement !",
        cards_suffix: " cartes"
      },
      lorcana: {
        "FirstChapter": "Premier Chapitre",
        "Floodborn": "L'Ascension Des Floodborn",
        "Ink": "Les Terres d'Encres",
        "Ursula": "Le Retour d'Ursula",
        "Ciel": "Ciel Scintillant",
        "Azurite": "La Mer Azurite",
        "Archazia": "L'Île d'Archazia",
        "Jafar": "Le Règne de Jafar",
        "Faboulus": "Fabuleux",
        "Lueur": "Lueurs dans les Profondeurs",
        "D100": "Disney 100",
        "Quest": "Quête des Illumineurs",
        "Promo": "Cartes Promotionnelles"
      },
      onepiece: {
        "OP01": "Romance Dawn",
        "OP02": "Paramount War",
        "OP03": "Pillars of Strength",
        "OP04": "Kingdoms of Intrigue",
        "OP05": "Awakening of the New Era",
        "OP06": "Wings of the Captain",
        "OP07": "500 Years in the Future",
        "OP08": "Two Legends",
        "OP09": "The Four Emperors",
        "OP10": "Sang Royal",
        "OP11": "Rêve Sans Fin",
        "OP12": "L'Héritage du Maître",
        "OP13": "Successeurs",
        "ST01": "Équipage du Chapeau de Paille",
        "ST02": "Pire Génération",
        "ST03": "Sept Grands Corsaires",
        "ST04": "Pirates de Cent Bêtes",
        "ST05": "ONE PIECE FILM edition",
        "ST06": "Marine",
        "ST07": "Équipage de Big Mom",
        "ST08": "Monkey D. Luffy",
        "ST09": "Yamato",
        "ST10": "Ultra Deck: Les Trois Capitaines",
        "ST11": "Uta",
        "ST12": "Zoro & Sanji",
        "ST13": "Ultra Deck: Les Trois Frères",
        "ST14": "3D2Y",
        "ST15": "RED Edward Newgate",
        "ST16": "GREEN Uta",
        "ST17": "BLUE Donquixote Doflamingo",
        "ST18": "PURPLE Monkey D. Luffy",
        "ST19": "BLACK Smoker",
        "ST20": "YELLOW Charlotte Katakuri",
        "ST21": "Gear 5",
        "ST22": "Ace & Newgate",
        "PRB01": "One Piece Card - The Best Vol.1",
        "PRB02": "One Piece Card - The Best Vol.2",
        "EB01": "Memorial Collection",
        "P": "Cartes Promotionnelles",
        "STP": "Promos Tournoi et Boutique"
      },
      riftbound: {
        "OGN": "Origines",
        "SFD": "Forgé par les Esprits",
        "OGS": "Origines - Épreuves"
      },
      starwars: {
        "SOR": "Étincelle de Rébellion",
        "SHD": "Ombres de la Galaxie",
        "TWI": "Crépuscule de la République",
        "JTL": "Passage en Vitesse Lumière",
        "LOF": "Légendes de la Force",
        "SEC": "Secrets du Pouvoir",
        "WSOR": "Weekly Play - Étincelle de Rébellion",
        "WSHD": "Weekly Play - Ombres de la Galaxie",
        "WTWI": "Weekly Play - Crépuscule de la République",
        "WJTL": "Weekly Play - Passage en Vitesse Lumière",
        "WLOF": "Weekly Play - Légendes de la Force",
        "OP": "Cartes Promotionnelles"
      }
    },
    filters: {
      clear: "Effacer",
      sortBy: {
        label: "Trier par",
        options: {
          number: "Numéro",
          name: "Nom",
          rarity: "Rareté"
        }
      },
      search: {
        name: {
          label: "Nom de la carte",
          placeholder: "Elsa, Mickey..."
        },
        number: {
          label: "Numéro de carte",
          placeholder: "001, 025..."
        }
      },
      language: "Langue",
      version: {
        label: "Version",
        all: "Toutes les versions",
        normal: "No foil",
        foil: "Foil"
      },
      inks: {
        label: "Encres",
        items: {
          amber: "Ambre",
          amethyst: "Améthyste",
          emerald: "Émeraude",
          ruby: "Rubis",
          sapphire: "Saphir",
          steel: "Acier"
        }
      },
      rarities: {
        label: "Rareté",
        items: {
          common: "Commune",
          uncommon: "Peu commune",
          rare: "Rare",
          "super-rare": "Super rare",
          legendary: "Légendaire",
          enchanted: "Enchantée",
          epic: "Épique",
          iconic: "Iconique",
          d23: "D23",
          es: "ES",
          gencon: "GenCon",
          gamescom: "GamesCom",
          d100: "D100",
          promo: "Promo",
          s: "Spéciale",
          dlc: "DLC",
          parc: "Parc",
          cruise: "Croisière"
        }
      }
    },
    auth: {
      welcome: {
        title: "Bienvenue",
        desc: "Connectez-vous ou créez un compte pour gérer votre collection."
      },
      login: {
        tab: "Connexion",
        title: "Connexion",
        desc: "Entrez vos identifiants pour vous connecter.",
        submit: "Se connecter"
      },
      register: {
        tab: "Inscription",
        title: "Inscription",
        desc: "Créez un compte pour gérer votre collection.",
        submit: "S'inscrire"
      },
      fields: {
        email: "Email",
        password: "Mot de passe"
      },
      or: "Ou continuer avec"
    },
    export: {
      button: "Export",
      success: "Export reussi ! Le fichier a ete telecharge.",
      error: "Erreur lors de l'export. Veuillez reessayer.",
      notLoggedIn: "Vous devez etre connecte pour exporter.",
      sheets: {
        complete: "Complet",
        myCollection: "Ma Collection",
        missing: "Manquantes"
      },
      headers: {
        number: "N°",
        name: "Nom",
        rarity: "Rarete",
        language: "Langue",
        owned: "Possede",
        qtyNormal: "Qte Normal",
        qtyFoil: "Qte Foil",
        total: "Total"
      },
      stats: {
        exportDate: "Export du",
        total: "Total",
        owned: "Possedees",
        missing: "Manquantes"
      }
    },
    share: {
      button: "Partager",
      title: "Partager ma collection",
      copied: "Lien copié !",
      revoked: "Lien révoqué",
      revoke: "Révoquer",
      copyLink: "Copier le lien",
      expiresOn: "Expire le",
      daysRemaining: "jours",
      error: "Erreur lors de la création du lien",
      revokeError: "Erreur lors de la révocation",
      invalidLink: "Lien de partage invalide",
      expiredMessage: "Ce lien a expiré ou n'existe pas. Les liens de partage sont valides pendant 24 heures.",
      sharedCollection: "Collection partagée",
      filterAll: "Toutes",
      filterOwned: "Possédées",
      filterMissing: "Manquantes",
      noCards: "Aucune carte",
      noOwned: "Aucune carte possédée",
      noMissing: "Aucune carte manquante"
    },
    footer: {
      description: "La plateforme ultime pour les collectionneurs de cartes TCG. Gérez vos collections Pokemon, Lorcana, One Piece et plus encore.",
      quickLinks: "Liens rapides",
      legal: "Légal",
      legalNotice: "Mentions légales",
      privacy: "Politique de confidentialité",
      madeWith: "Fait avec",
      inFrance: "en France"
    },
    legal: {
      title: "Mentions Légales",
      lastUpdate: "Dernière mise à jour",
      editor: {
        title: "Éditeur du site",
        name: "Nom",
        status: "Statut",
        statusValue: "Site personnel / Projet en développement",
        email: "Email"
      },
      hosting: {
        title: "Hébergement",
        name: "Hébergeur",
        address: "Adresse",
        website: "Site web"
      },
      database: {
        title: "Base de données",
        name: "Fournisseur",
        location: "Localisation",
        website: "Site web"
      },
      intellectual: {
        title: "Propriété intellectuelle",
        content: "Le site CollectorVerse est un outil de gestion de collection personnel. Les images des cartes sont la propriété de leurs détenteurs respectifs (The Pokemon Company, Disney/Ravensburger, Bandai, Riot Games, etc.).",
        trademarks: "Pokemon, Lorcana, One Piece, Riftbound, Naruto et tous les noms, logos et images associés sont des marques déposées de leurs propriétaires respectifs. Ce site n'est pas affilié à ces entreprises."
      },
      responsibility: {
        title: "Responsabilité",
        content: "CollectorVerse s'efforce de fournir des informations exactes et à jour. Cependant, nous ne pouvons garantir l'exactitude, l'exhaustivité ou l'actualité des informations diffusées sur ce site. L'utilisation du site se fait sous votre propre responsabilité."
      },
      law: {
        title: "Droit applicable",
        content: "Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux français seront seuls compétents."
      }
    },
    privacy: {
      title: "Politique de Confidentialité",
      subtitle: "Nous respectons votre vie privée et protégeons vos données personnelles.",
      intro: "CollectorVerse s'engage à protéger la confidentialité de vos données personnelles conformément au Règlement Général sur la Protection des Données (RGPD).",
      lastUpdate: "Dernière mise à jour",
      dataCollected: {
        title: "Données collectées",
        content: "Nous collectons uniquement les données nécessaires au fonctionnement du service :",
        items: [
          "Adresse email (pour l'authentification)",
          "Préférences de langue",
          "Données de collection (cartes possédées, quantités)"
        ]
      },
      dataUsage: {
        title: "Utilisation des données",
        content: "Vos données sont utilisées exclusivement pour :",
        items: [
          "Gérer votre compte et authentification",
          "Sauvegarder et synchroniser votre collection",
          "Améliorer l'expérience utilisateur"
        ]
      },
      cookies: {
        title: "Cookies",
        content: "Nous utilisons uniquement des cookies essentiels :",
        items: [
          "Cookies de session (authentification)",
          "Préférences utilisateur (thème, langue)"
        ]
      },
      rights: {
        title: "Vos droits RGPD",
        access: "Droit d'accès",
        accessDesc: "Obtenez une copie de vos données personnelles",
        rectification: "Droit de rectification",
        rectificationDesc: "Corrigez vos informations personnelles",
        deletion: "Droit à l'effacement",
        deletionDesc: "Demandez la suppression de vos données"
      },
      retention: {
        title: "Conservation des données",
        content: "Vos données sont conservées tant que votre compte est actif.",
        deletion: "Suppression",
        deletionDesc: "Vos données sont supprimées définitivement dans les 30 jours suivant la suppression de votre compte."
      },
      contact: {
        title: "Contact",
        content: "Pour toute question concernant vos données personnelles, contactez-nous :"
      }
    }
  },
  en: {
    nav: {
      home: "Home",
      pokemon: "Pokémon",
      lorcana: "Lorcana",
      onepiece: "One Piece",
      riftbound: "Riftbound",
      naruto: "Naruto",
      starwars: "Star Wars",
      login: "Login",
      logout: "Logout",
      menu: "Menu"
    },
    home: {
      hero: {
        explore: "Explore",
        platform: "The ultimate platform for collectors. Manage, track and complete your card collections across all universes."
      },
      tcg: {
        pokemon: {
          desc: "Gotta Catch 'Em All",
          stats: "1000+ cards"
        },
        lorcana: {
          desc: "Disney Magic Universe",
          stats: "500+ cards"
        },
        onepiece: {
          desc: "The Great Pirate Era",
          stats: "700+ cards"
        },
        riftbound: {
          desc: "Tactical Legends",
          stats: "400+ cards"
        },
        naruto: {
          desc: "Way of the Ninja",
          stats: "300+ cards"
        },
        starwars: {
          desc: "A Galaxy Far, Far Away",
          stats: "3000+ cards"
        }
      }
    },
    series: {
      page: {
        title: "Series",
        subtitle: "Discover all available series"
      },
      grid: {
        empty: "No series available at the moment.",
        coming_soon: "Series will be added soon!",
        cards_suffix: " cards"
      },
      lorcana: {
        "FirstChapter": "The First Chapter",
        "Floodborn": "Rise of the Floodborn",
        "Ink": "Into the Inklands",
        "Ursula": "Ursula's Return",
        "Ciel": "Shimmering Skies",
        "Azurite": "Azurite Sea",
        "Archazia": "Archazia's Island",
        "Jafar": "Reign of Jafar",
        "Faboulus": "Fabled",
        "Lueur": "Whispers in the Well",
        "D100": "Disney 100",
        "Quest": "Illumineer's Quest",
        "Promo": "Promo Cards"
      },
      onepiece: {
        "OP01": "Romance Dawn",
        "OP02": "Paramount War",
        "OP03": "Pillars of Strength",
        "OP04": "Kingdoms of Intrigue",
        "OP05": "Awakening of the New Era",
        "OP06": "Wings of the Captain",
        "OP07": "500 Years in the Future",
        "OP08": "Two Legends",
        "OP09": "The Four Emperors",
        "OP10": "Royal Blood",
        "OP11": "Endless Dream",
        "OP12": "Master's Legacy",
        "OP13": "Successors",
        "ST01": "Straw Hat Crew",
        "ST02": "Worst Generation",
        "ST03": "The Seven Warlords of the Sea",
        "ST04": "Animal Kingdom Pirates",
        "ST05": "ONE PIECE FILM edition",
        "ST06": "Navy",
        "ST07": "Big Mom Pirates",
        "ST08": "Monkey D. Luffy",
        "ST09": "Yamato",
        "ST10": "Ultra Deck: The Three Captains",
        "ST11": "Uta",
        "ST12": "Zoro & Sanji",
        "ST13": "Ultra Deck: The Three Brothers",
        "ST14": "3D2Y",
        "ST15": "RED Edward Newgate",
        "ST16": "GREEN Uta",
        "ST17": "BLUE Donquixote Doflamingo",
        "ST18": "PURPLE Monkey D. Luffy",
        "ST19": "BLACK Smoker",
        "ST20": "YELLOW Charlotte Katakuri",
        "ST21": "Gear 5",
        "ST22": "Ace & Newgate",
        "PRB01": "One Piece Card - The Best Vol.1",
        "PRB02": "One Piece Card - The Best Vol.2",
        "EB01": "Memorial Collection",
        "P": "Promotional Cards",
        "STP": "Tournament & Shop Promos"
      },
      riftbound: {
        "OGN": "Origins",
        "SFD": "Spiritforged",
        "OGS": "Origins - Proving Grounds"
      },
      starwars: {
        "SOR": "Spark of Rebellion",
        "SHD": "Shadows of the Galaxy",
        "TWI": "Twilight of the Republic",
        "JTL": "Jump to Lightspeed",
        "LOF": "Legends of the Force",
        "SEC": "Secrets of Power",
        "WSOR": "Weekly Play - Spark of Rebellion",
        "WSHD": "Weekly Play - Shadows of the Galaxy",
        "WTWI": "Weekly Play - Twilight of the Republic",
        "WJTL": "Weekly Play - Jump to Lightspeed",
        "WLOF": "Weekly Play - Legends of the Force",
        "OP": "Promotional Cards"
      }
    },
    filters: {
      clear: "Clear",
      sortBy: {
        label: "Sort by",
        options: {
          number: "Number",
          name: "Name",
          rarity: "Rarity"
        }
      },
      search: {
        name: {
          label: "Card Name",
          placeholder: "Elsa, Mickey..."
        },
        number: {
          label: "Card Number",
          placeholder: "001, 025..."
        }
      },
      language: "Language",
      version: {
        label: "Version",
        all: "All versions",
        normal: "No foil",
        foil: "Foil"
      },
      inks: {
        label: "Inks",
        items: {
          amber: "Amber",
          amethyst: "Amethyst",
          emerald: "Emerald",
          ruby: "Ruby",
          sapphire: "Sapphire",
          steel: "Steel"
        }
      },
      rarities: {
        label: "Rarity",
        items: {
          common: "Common",
          uncommon: "Uncommon",
          rare: "Rare",
          "super-rare": "Super Rare",
          legendary: "Legendary",
          enchanted: "Enchanted",
          epic: "Epic",
          iconic: "Iconic",
          d23: "D23",
          es: "ES",
          gencon: "GenCon",
          gamescom: "GamesCom",
          d100: "D100",
          promo: "Promo",
          s: "Special",
          dlc: "DLC",
          parc: "Park",
          cruise: "Cruise"
        }
      }
    },
    auth: {
      welcome: {
        title: "Welcome",
        desc: "Log in or create an account to manage your collection."
      },
      login: {
        tab: "Login",
        title: "Login",
        desc: "Enter your credentials to access your account.",
        submit: "Sign In"
      },
      register: {
        tab: "Sign Up",
        title: "Sign Up",
        desc: "Create an account to manage your collection.",
        submit: "Sign Up"
      },
      fields: {
        email: "Email",
        password: "Password"
      },
      or: "Or continue with"
    },
    export: {
      button: "Export",
      success: "Export successful! File has been downloaded.",
      error: "Export failed. Please try again.",
      notLoggedIn: "You must be logged in to export.",
      sheets: {
        complete: "Complete",
        myCollection: "My Collection",
        missing: "Missing"
      },
      headers: {
        number: "No.",
        name: "Name",
        rarity: "Rarity",
        language: "Language",
        owned: "Owned",
        qtyNormal: "Qty Normal",
        qtyFoil: "Qty Foil",
        total: "Total"
      },
      stats: {
        exportDate: "Export date",
        total: "Total",
        owned: "Owned",
        missing: "Missing"
      }
    },
    share: {
      button: "Share",
      title: "Share my collection",
      copied: "Link copied!",
      revoked: "Link revoked",
      revoke: "Revoke",
      copyLink: "Copy link",
      expiresOn: "Expires on",
      daysRemaining: "days",
      error: "Error creating link",
      revokeError: "Error revoking link",
      invalidLink: "Invalid share link",
      expiredMessage: "This link has expired or does not exist. Share links are valid for 24 hours.",
      sharedCollection: "Shared collection",
      filterAll: "All",
      filterOwned: "Owned",
      filterMissing: "Missing",
      noCards: "No cards",
      noOwned: "No owned cards",
      noMissing: "No missing cards"
    },
    footer: {
      description: "The ultimate platform for TCG card collectors. Manage your Pokemon, Lorcana, One Piece collections and more.",
      quickLinks: "Quick Links",
      legal: "Legal",
      legalNotice: "Legal Notice",
      privacy: "Privacy Policy",
      madeWith: "Made with",
      inFrance: "in France"
    },
    legal: {
      title: "Legal Notice",
      lastUpdate: "Last updated",
      editor: {
        title: "Site Editor",
        name: "Name",
        status: "Status",
        statusValue: "Personal website / Development project",
        email: "Email"
      },
      hosting: {
        title: "Hosting",
        name: "Host",
        address: "Address",
        website: "Website"
      },
      database: {
        title: "Database",
        name: "Provider",
        location: "Location",
        website: "Website"
      },
      intellectual: {
        title: "Intellectual Property",
        content: "CollectorVerse is a personal collection management tool. Card images are the property of their respective owners (The Pokemon Company, Disney/Ravensburger, Bandai, Riot Games, etc.).",
        trademarks: "Pokemon, Lorcana, One Piece, Riftbound, Naruto and all associated names, logos and images are registered trademarks of their respective owners. This site is not affiliated with these companies."
      },
      responsibility: {
        title: "Liability",
        content: "CollectorVerse strives to provide accurate and up-to-date information. However, we cannot guarantee the accuracy, completeness, or timeliness of information published on this site. Use of the site is at your own risk."
      },
      law: {
        title: "Applicable Law",
        content: "These legal notices are governed by French law. In case of dispute, French courts shall have exclusive jurisdiction."
      }
    },
    privacy: {
      title: "Privacy Policy",
      subtitle: "We respect your privacy and protect your personal data.",
      intro: "CollectorVerse is committed to protecting the privacy of your personal data in accordance with the General Data Protection Regulation (GDPR).",
      lastUpdate: "Last updated",
      dataCollected: {
        title: "Data Collected",
        content: "We only collect data necessary for the service:",
        items: [
          "Email address (for authentication)",
          "Language preferences",
          "Collection data (owned cards, quantities)"
        ]
      },
      dataUsage: {
        title: "Data Usage",
        content: "Your data is used exclusively for:",
        items: [
          "Managing your account and authentication",
          "Saving and syncing your collection",
          "Improving user experience"
        ]
      },
      cookies: {
        title: "Cookies",
        content: "We only use essential cookies:",
        items: [
          "Session cookies (authentication)",
          "User preferences (theme, language)"
        ]
      },
      rights: {
        title: "Your GDPR Rights",
        access: "Right of Access",
        accessDesc: "Get a copy of your personal data",
        rectification: "Right to Rectification",
        rectificationDesc: "Correct your personal information",
        deletion: "Right to Erasure",
        deletionDesc: "Request deletion of your data"
      },
      retention: {
        title: "Data Retention",
        content: "Your data is kept as long as your account is active.",
        deletion: "Deletion",
        deletionDesc: "Your data is permanently deleted within 30 days of account deletion."
      },
      contact: {
        title: "Contact",
        content: "For any questions about your personal data, contact us:"
      }
    }
  },
  jp: {
    nav: {
      home: "ホーム",
      pokemon: "ポケモン",
      lorcana: "ロルカナ",
      onepiece: "ワンピース",
      riftbound: "リフトバウンド",
      naruto: "ナルト",
      starwars: "スター・ウォーズ",
      login: "ログイン",
      logout: "ログアウト",
      menu: "メニュー"
    },
    home: {
      hero: {
        explore: "探索する",
        platform: "コレクターのための究極のプラットフォーム。すべての世界でカードコレクションを管理、追跡、完了します。"
      },
      tcg: {
        pokemon: {
          desc: "ポケモンゲットだぜ！",
          stats: "1000+ カード"
        },
        lorcana: {
          desc: "ディズニー魔法の世界",
          stats: "500+ カード"
        },
        onepiece: {
          desc: "大海賊時代",
          stats: "700+ カード"
        },
        riftbound: {
          desc: "戦術の伝説",
          stats: "400+ カード"
        },
        naruto: {
          desc: "忍者の道",
          stats: "300+ カード"
        },
        starwars: {
          desc: "遥か彼方の銀河系",
          stats: "3000+ カード"
        }
      }
    },
    series: {
      page: {
        title: "シリーズ",
        subtitle: "利用可能なすべてのシリーズを発見"
      },
      grid: {
        empty: "現在利用可能なシリーズはありません。",
        coming_soon: "シリーズは近日追加予定です！",
        cards_suffix: " カード"
      },
      lorcana: {
        "FirstChapter": "物語のはじまり",
        "Floodborn": "フラッドボーンの渾沌",
        "Ink": "インクランド探訪",
        "Ursula": "逆襲のアースラ",
        "Ciel": "星々の輝き",
        "Azurite": "大いなるアズライト",
        "Archazia": "アーケイジアと魔法の島",
        "Jafar": "ジャファーの統治",
        "Faboulus": "フェイブルド",
        "Lueur": "井戸の囁き",
        "D100": "ディズニー100",
        "Quest": "イルミニアの冒険",
        "Promo": "プロモカード"
      },
      onepiece: {
        "OP01": "ロマンスドーン",
        "OP02": "頂上決戦",
        "OP03": "強大な敵",
        "OP04": "謀略の王国",
        "OP05": "新時代の主役",
        "OP06": "双璧の覇者",
        "OP07": "500年後の未来",
        "OP08": "二つの伝説",
        "OP09": "四皇",
        "OP10": "ロイヤルブラッド",
        "OP11": "エンドレスドリーム",
        "OP12": "マスターズレガシー",
        "OP13": "サクセサーズ",
        "ST01": "麦わらの一味",
        "ST02": "最悪の世代",
        "ST03": "王下七武海",
        "ST04": "百獣海賊団",
        "ST05": "ONE PIECE FILM edition",
        "ST06": "海軍",
        "ST07": "ビッグ・マム海賊団",
        "ST08": "モンキー・D・ルフィ",
        "ST09": "ヤマト",
        "ST10": "ウルトラデッキ 三船長集結",
        "ST11": "ウタ",
        "ST12": "ゾロ＆サンジ",
        "ST13": "ウルトラデッキ 三兄弟の絆",
        "ST14": "3D2Y",
        "ST15": "RED エドワード・ニューゲート",
        "ST16": "GREEN ウタ",
        "ST17": "BLUE ドンキホーテ・ドフラミンゴ",
        "ST18": "PURPLE モンキー・D・ルフィ",
        "ST19": "BLACK スモーカー",
        "ST20": "YELLOW シャーロット・カタクリ",
        "ST21": "ギア5",
        "ST22": "エース＆ニューゲート",
        "PRB01": "ワンピースカード ザ・ベスト Vol.1",
        "PRB02": "ワンピースカード ザ・ベスト Vol.2",
        "EB01": "メモリアルコレクション",
        "P": "プロモカード",
        "STP": "大会・ショッププロモ"
      },
      riftbound: {
        "OGN": "オリジンズ",
        "SFD": "スピリットフォージド",
        "OGS": "オリジンズ - プルービンググラウンド"
      },
      starwars: {
        "SOR": "反乱の火花",
        "SHD": "銀河の影",
        "TWI": "共和国の黄昏",
        "JTL": "光速へのジャンプ",
        "LOF": "フォースの伝説",
        "SEC": "力の秘密",
        "WSOR": "ウィークリープレイ - 反乱の火花",
        "WSHD": "ウィークリープレイ - 銀河の影",
        "WTWI": "ウィークリープレイ - 共和国の黄昏",
        "WJTL": "ウィークリープレイ - 光速へのジャンプ",
        "WLOF": "ウィークリープレイ - フォースの伝説",
        "OP": "プロモカード"
      }
    },
    filters: {
      clear: "クリア",
      sortBy: {
        label: "並び替え",
        options: {
          number: "番号",
          name: "名前",
          rarity: "レアリティ"
        }
      },
      search: {
        name: {
          label: "カード名",
          placeholder: "エルサ、ミッキー..."
        },
        number: {
          label: "カード番号",
          placeholder: "001, 025..."
        }
      },
      language: "言語",
      version: {
        label: "バージョン",
        all: "すべてのバージョン",
        normal: "No foil",
        foil: "フォイル"
      },
      inks: {
        label: "インク",
        items: {
          amber: "アンバー",
          amethyst: "アメジスト",
          emerald: "エメラルド",
          ruby: "ルビー",
          sapphire: "サファイア",
          steel: "スチール"
        }
      },
      rarities: {
        label: "レアリティ",
        items: {
          common: "コモン",
          uncommon: "アンコモン",
          rare: "レア",
          "super-rare": "スーパーレア",
          legendary: "レジェンダリー",
          enchanted: "エンチャンテッド",
          epic: "エピック",
          iconic: "アイコニック",
          d23: "D23",
          es: "ES",
          gencon: "GenCon",
          gamescom: "GamesCom",
          d100: "D100",
          promo: "プロモ",
          s: "スペシャル",
          dlc: "DLC",
          parc: "パーク",
          cruise: "クルーズ"
        }
      }
    },
    auth: {
      welcome: {
        title: "ようこそ",
        desc: "コレクションを管理するには、ログインまたはアカウントを作成してください。"
      },
      login: {
        tab: "ログイン",
        title: "ログイン",
        desc: "認証情報を入力してログインしてください。",
        submit: "ログイン"
      },
      register: {
        tab: "登録",
        title: "登録",
        desc: "コレクションを管理するためのアカウントを作成します。",
        submit: "登録"
      },
      fields: {
        email: "メールアドレス",
        password: "パスワード"
      },
      or: "または以下で続行"
    },
    export: {
      button: "エクスポート",
      success: "エクスポート成功！ファイルがダウンロードされました。",
      error: "エクスポートに失敗しました。もう一度お試しください。",
      notLoggedIn: "エクスポートするにはログインが必要です。",
      sheets: {
        complete: "完全版",
        myCollection: "マイコレクション",
        missing: "未所持"
      },
      headers: {
        number: "番号",
        name: "名前",
        rarity: "レアリティ",
        language: "言語",
        owned: "所持",
        qtyNormal: "通常数",
        qtyFoil: "フォイル数",
        total: "合計"
      },
      stats: {
        exportDate: "エクスポート日",
        total: "合計",
        owned: "所持",
        missing: "未所持"
      }
    },
    share: {
      button: "共有",
      title: "コレクションを共有",
      copied: "リンクをコピーしました！",
      revoked: "リンクを取り消しました",
      revoke: "取り消す",
      copyLink: "リンクをコピー",
      expiresOn: "有効期限",
      daysRemaining: "日",
      error: "リンクの作成に失敗しました",
      revokeError: "リンクの取り消しに失敗しました",
      invalidLink: "無効な共有リンク",
      expiredMessage: "このリンクは期限切れか存在しません。共有リンクは24時間有効です。",
      sharedCollection: "共有コレクション",
      filterAll: "すべて",
      filterOwned: "所持",
      filterMissing: "未所持",
      noCards: "カードがありません",
      noOwned: "所持カードがありません",
      noMissing: "未所持カードがありません"
    },
    footer: {
      description: "TCGカードコレクターのための究極のプラットフォーム。ポケモン、ロルカナ、ワンピースなどのコレクションを管理。",
      quickLinks: "クイックリンク",
      legal: "法的情報",
      legalNotice: "法的通知",
      privacy: "プライバシーポリシー",
      madeWith: "で作られました",
      inFrance: "フランス"
    },
    legal: {
      title: "法的通知",
      lastUpdate: "最終更新日",
      editor: {
        title: "サイト運営者",
        name: "名前",
        status: "ステータス",
        statusValue: "個人サイト / 開発中プロジェクト",
        email: "メール"
      },
      hosting: {
        title: "ホスティング",
        name: "ホスト",
        address: "住所",
        website: "ウェブサイト"
      },
      database: {
        title: "データベース",
        name: "プロバイダー",
        location: "場所",
        website: "ウェブサイト"
      },
      intellectual: {
        title: "知的財産権",
        content: "CollectorVerseは個人的なコレクション管理ツールです。カード画像はそれぞれの所有者（The Pokemon Company、Disney/Ravensburger、Bandai、Riot Gamesなど）の財産です。",
        trademarks: "ポケモン、ロルカナ、ワンピース、リフトバウンド、ナルトおよび関連するすべての名前、ロゴ、画像は、それぞれの所有者の登録商標です。このサイトはこれらの企業とは提携していません。"
      },
      responsibility: {
        title: "責任",
        content: "CollectorVerseは正確で最新の情報を提供するよう努めています。ただし、このサイトに掲載されている情報の正確性、完全性、適時性を保証することはできません。サイトのご利用は自己責任でお願いします。"
      },
      law: {
        title: "準拠法",
        content: "この法的通知はフランス法に準拠します。紛争が発生した場合、フランスの裁判所が専属管轄権を有します。"
      }
    },
    privacy: {
      title: "プライバシーポリシー",
      subtitle: "私たちはあなたのプライバシーを尊重し、個人データを保護します。",
      intro: "CollectorVerseは、一般データ保護規則（GDPR）に従って、お客様の個人データの機密性を保護することに取り組んでいます。",
      lastUpdate: "最終更新日",
      dataCollected: {
        title: "収集データ",
        content: "サービスに必要なデータのみを収集します：",
        items: [
          "メールアドレス（認証用）",
          "言語設定",
          "コレクションデータ（所持カード、数量）"
        ]
      },
      dataUsage: {
        title: "データの使用",
        content: "お客様のデータは以下の目的でのみ使用されます：",
        items: [
          "アカウントと認証の管理",
          "コレクションの保存と同期",
          "ユーザーエクスペリエンスの向上"
        ]
      },
      cookies: {
        title: "クッキー",
        content: "必須クッキーのみを使用します：",
        items: [
          "セッションクッキー（認証）",
          "ユーザー設定（テーマ、言語）"
        ]
      },
      rights: {
        title: "GDPRの権利",
        access: "アクセス権",
        accessDesc: "個人データのコピーを取得",
        rectification: "訂正権",
        rectificationDesc: "個人情報を訂正",
        deletion: "削除権",
        deletionDesc: "データの削除を要求"
      },
      retention: {
        title: "データ保持",
        content: "アカウントがアクティブな間、データは保持されます。",
        deletion: "削除",
        deletionDesc: "アカウント削除後30日以内にデータは完全に削除されます。"
      },
      contact: {
        title: "お問い合わせ",
        content: "個人データに関するご質問は、こちらまでお問い合わせください："
      }
    }
  },
  zh: {
    nav: {
      home: "首页",
      pokemon: "宝可梦",
      lorcana: "洛卡纳",
      onepiece: "海贼王",
      riftbound: "裂隙征服",
      naruto: "火影忍者",
      starwars: "星球大战",
      login: "登录",
      logout: "退出",
      menu: "菜单"
    },
    home: {
      hero: {
        explore: "探索",
        platform: "收藏家的终极平台。管理、追踪并完善您在所有宇宙中的卡牌收藏。"
      },
      tcg: {
        pokemon: {
          desc: "全部收集！",
          stats: "1000+ 卡牌"
        },
        lorcana: {
          desc: "迪士尼魔法世界",
          stats: "500+ 卡牌"
        },
        onepiece: {
          desc: "大海贼时代",
          stats: "700+ 卡牌"
        },
        riftbound: {
          desc: "战术传奇",
          stats: "400+ 卡牌"
        },
        naruto: {
          desc: "忍者之道",
          stats: "300+ 卡牌"
        },
        starwars: {
          desc: "遥远的银河系",
          stats: "3000+ 卡牌"
        }
      }
    },
    series: {
      page: {
        title: "系列",
        subtitle: "发现所有可用系列"
      },
      grid: {
        empty: "目前没有可用的系列。",
        coming_soon: "系列即将添加！",
        cards_suffix: " 卡牌"
      },
      lorcana: {
        "FirstChapter": "第一章",
        "Floodborn": "泛滥之源崛起",
        "Ink": "墨境之旅",
        "Ursula": "乌苏拉的归来",
        "Ciel": "闪烁的天空",
        "Azurite": "蔚蓝之海",
        "Archazia": "阿卡齐亚之岛",
        "Jafar": "贾法尔的统治",
        "Faboulus": "传奇",
        "Lueur": "井中低语",
        "D100": "迪士尼100",
        "Quest": "光明使者之旅",
        "Promo": "促销卡"
      },
      onepiece: {
        "OP01": "浪漫黎明",
        "OP02": "顶上战争",
        "OP03": "力量之柱",
        "OP04": "阴谋王国",
        "OP05": "新时代的主角",
        "OP06": "船长之翼",
        "OP07": "500年后的未来",
        "OP08": "两个传说",
        "OP09": "四皇",
        "OP10": "皇室血统",
        "OP11": "无尽之梦",
        "OP12": "大师的遗产",
        "OP13": "继承者",
        "ST01": "草帽一伙",
        "ST02": "最恶世代",
        "ST03": "王下七武海",
        "ST04": "百兽海贼团",
        "ST05": "ONE PIECE FILM edition",
        "ST06": "海军",
        "ST07": "BIG MOM海贼团",
        "ST08": "蒙奇·D·路飞",
        "ST09": "大和",
        "ST10": "Ultra Deck: 三船长",
        "ST11": "乌塔",
        "ST12": "索隆 & 山治",
        "ST13": "Ultra Deck: 三兄弟",
        "ST14": "3D2Y",
        "ST15": "RED 爱德华·纽盖特",
        "ST16": "GREEN 乌塔",
        "ST17": "BLUE 堂吉诃德·多弗朗明哥",
        "ST18": "PURPLE 蒙奇·D·路飞",
        "ST19": "BLACK 斯摩格",
        "ST20": "YELLOW 夏洛特·卡塔库栗",
        "ST21": "五档",
        "ST22": "艾斯 & 纽盖特",
        "PRB01": "海贼王卡牌 精选集 Vol.1",
        "PRB02": "海贼王卡牌 精选集 Vol.2",
        "EB01": "纪念收藏",
        "P": "促销卡",
        "STP": "锦标赛 & 商店促销"
      },
      riftbound: {
        "OGN": "起源",
        "SFD": "灵魂锻造",
        "OGS": "起源 - 试炼场"
      },
      starwars: {
        "SOR": "反叛的火花",
        "SHD": "银河暗影",
        "TWI": "共和国的黄昏",
        "JTL": "光速跳跃",
        "LOF": "原力传说",
        "SEC": "力量之秘",
        "WSOR": "每周游戏 - 反叛的火花",
        "WSHD": "每周游戏 - 银河暗影",
        "WTWI": "每周游戏 - 共和国的黄昏",
        "WJTL": "每周游戏 - 光速跳跃",
        "WLOF": "每周游戏 - 原力传说",
        "OP": "促销卡"
      }
    },
    filters: {
      clear: "清除",
      sortBy: {
        label: "排序方式",
        options: {
          number: "编号",
          name: "名称",
          rarity: "稀有度"
        }
      },
      search: {
        name: {
          label: "卡牌名称",
          placeholder: "艾莎、米奇..."
        },
        number: {
          label: "卡牌编号",
          placeholder: "001、025..."
        }
      },
      language: "语言",
      version: {
        label: "版本",
        all: "所有版本",
        normal: "普通",
        foil: "闪卡"
      },
      inks: {
        label: "墨水",
        items: {
          amber: "琥珀",
          amethyst: "紫水晶",
          emerald: "翡翠",
          ruby: "红宝石",
          sapphire: "蓝宝石",
          steel: "钢铁"
        }
      },
      rarities: {
        label: "稀有度",
        items: {
          common: "普通",
          uncommon: "少见",
          rare: "稀有",
          "super-rare": "超稀有",
          legendary: "传说",
          enchanted: "附魔",
          epic: "史诗",
          iconic: "标志性",
          d23: "D23",
          es: "ES",
          gencon: "GenCon",
          gamescom: "GamesCom",
          d100: "D100",
          promo: "促销",
          s: "特殊",
          dlc: "DLC",
          parc: "乐园",
          cruise: "邮轮"
        }
      }
    },
    auth: {
      welcome: {
        title: "欢迎",
        desc: "登录或创建账户来管理您的收藏。"
      },
      login: {
        tab: "登录",
        title: "登录",
        desc: "输入您的凭据以登录。",
        submit: "登录"
      },
      register: {
        tab: "注册",
        title: "注册",
        desc: "创建一个账户来管理您的收藏。",
        submit: "注册"
      },
      fields: {
        email: "邮箱",
        password: "密码"
      },
      or: "或使用以下方式继续"
    },
    export: {
      button: "导出",
      success: "导出成功！文件已下载。",
      error: "导出失败。请重试。",
      notLoggedIn: "您必须登录才能导出。",
      sheets: {
        complete: "完整版",
        myCollection: "我的收藏",
        missing: "缺失"
      },
      headers: {
        number: "编号",
        name: "名称",
        rarity: "稀有度",
        language: "语言",
        owned: "拥有",
        qtyNormal: "普通数量",
        qtyFoil: "闪卡数量",
        total: "总计"
      },
      stats: {
        exportDate: "导出日期",
        total: "总计",
        owned: "已拥有",
        missing: "缺失"
      }
    },
    share: {
      button: "分享",
      title: "分享我的收藏",
      copied: "链接已复制！",
      revoked: "链接已撤销",
      revoke: "撤销",
      copyLink: "复制链接",
      expiresOn: "到期日",
      daysRemaining: "天",
      error: "创建链接失败",
      revokeError: "撤销链接失败",
      invalidLink: "无效的分享链接",
      expiredMessage: "此链接已过期或不存在。分享链接有效期为24小时。",
      sharedCollection: "分享的收藏",
      filterAll: "全部",
      filterOwned: "已拥有",
      filterMissing: "缺失",
      noCards: "没有卡牌",
      noOwned: "没有已拥有的卡牌",
      noMissing: "没有缺失的卡牌"
    },
    footer: {
      description: "TCG卡牌收藏家的终极平台。管理您的宝可梦、洛卡纳、海贼王等收藏。",
      quickLinks: "快速链接",
      legal: "法律信息",
      legalNotice: "法律声明",
      privacy: "隐私政策",
      madeWith: "用心制作于",
      inFrance: "法国"
    },
    legal: {
      title: "法律声明",
      lastUpdate: "最后更新",
      editor: {
        title: "网站编辑",
        name: "名称",
        status: "状态",
        statusValue: "个人网站 / 开发中项目",
        email: "邮箱"
      },
      hosting: {
        title: "托管",
        name: "托管商",
        address: "地址",
        website: "网站"
      },
      database: {
        title: "数据库",
        name: "提供商",
        location: "位置",
        website: "网站"
      },
      intellectual: {
        title: "知识产权",
        content: "CollectorVerse是一个个人收藏管理工具。卡牌图片是其各自所有者（The Pokemon Company、Disney/Ravensburger、Bandai、Riot Games等）的财产。",
        trademarks: "宝可梦、洛卡纳、海贼王、裂隙征服、火影忍者及所有相关名称、徽标和图像是其各自所有者的注册商标。本网站与这些公司无关联。"
      },
      responsibility: {
        title: "责任",
        content: "CollectorVerse致力于提供准确和最新的信息。但是，我们无法保证本网站上发布的信息的准确性、完整性或及时性。使用本网站风险自负。"
      },
      law: {
        title: "适用法律",
        content: "本法律声明受法国法律管辖。如发生争议，法国法院拥有专属管辖权。"
      }
    },
    privacy: {
      title: "隐私政策",
      subtitle: "我们尊重您的隐私并保护您的个人数据。",
      intro: "CollectorVerse承诺根据《通用数据保护条例》(GDPR)保护您个人数据的隐私。",
      lastUpdate: "最后更新",
      dataCollected: {
        title: "收集的数据",
        content: "我们仅收集服务所需的数据：",
        items: [
          "电子邮件地址（用于身份验证）",
          "语言偏好",
          "收藏数据（拥有的卡牌、数量）"
        ]
      },
      dataUsage: {
        title: "数据使用",
        content: "您的数据仅用于：",
        items: [
          "管理您的账户和身份验证",
          "保存和同步您的收藏",
          "改善用户体验"
        ]
      },
      cookies: {
        title: "Cookies",
        content: "我们仅使用必要的cookies：",
        items: [
          "会话cookies（身份验证）",
          "用户偏好（主题、语言）"
        ]
      },
      rights: {
        title: "您的GDPR权利",
        access: "访问权",
        accessDesc: "获取您个人数据的副本",
        rectification: "更正权",
        rectificationDesc: "更正您的个人信息",
        deletion: "删除权",
        deletionDesc: "请求删除您的数据"
      },
      retention: {
        title: "数据保留",
        content: "只要您的账户处于活动状态，您的数据就会被保留。",
        deletion: "删除",
        deletionDesc: "账户删除后30天内，您的数据将被永久删除。"
      },
      contact: {
        title: "联系方式",
        content: "如有关于您个人数据的任何问题，请联系我们："
      }
    }
  }
};
