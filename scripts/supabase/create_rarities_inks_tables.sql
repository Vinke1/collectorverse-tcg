-- Créer la table rarities (raretés)
CREATE TABLE IF NOT EXISTS public.rarities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tcg_game_id UUID NOT NULL REFERENCES public.tcg_games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tcg_game_id, code)
);

-- Créer la table inks (encres pour Lorcana)
CREATE TABLE IF NOT EXISTS public.inks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tcg_game_id UUID NOT NULL REFERENCES public.tcg_games(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    icon_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tcg_game_id, code)
);

-- Créer des index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_rarities_tcg_game_id ON public.rarities(tcg_game_id);
CREATE INDEX IF NOT EXISTS idx_inks_tcg_game_id ON public.inks(tcg_game_id);

-- Enable Row Level Security
ALTER TABLE public.rarities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inks ENABLE ROW LEVEL SECURITY;

-- Créer des politiques RLS pour la lecture publique
CREATE POLICY "Enable read access for all users" ON public.rarities
    FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON public.inks
    FOR SELECT USING (true);

-- Insérer les raretés pour Lorcana (récupérer l'ID de Lorcana d'abord)
DO $$
DECLARE
    lorcana_id UUID;
BEGIN
    -- Récupérer l'ID du jeu Lorcana
    SELECT id INTO lorcana_id FROM public.tcg_games WHERE slug = 'lorcana' LIMIT 1;

    IF lorcana_id IS NOT NULL THEN
        -- Insérer les raretés Lorcana
        INSERT INTO public.rarities (tcg_game_id, name, code, icon_url) VALUES
        (lorcana_id, 'Commune', 'C', '/images/icons/rarities/common.webp'),
        (lorcana_id, 'Peu commune', 'UC', '/images/icons/rarities/uncommon.webp'),
        (lorcana_id, 'Rare', 'R', '/images/icons/rarities/rare.webp'),
        (lorcana_id, 'Super rare', 'SR', '/images/icons/rarities/super-rare.webp'),
        (lorcana_id, 'Légendaire', 'L', '/images/icons/rarities/legendary.webp'),
        (lorcana_id, 'Enchantée', 'E', '/images/icons/rarities/enchanted.webp'),
        (lorcana_id, 'Épique', 'EP', '/images/icons/rarities/epic.webp'),
        (lorcana_id, 'Iconique', 'IC', '/images/icons/rarities/iconic.webp'),
        (lorcana_id, 'D23', 'D23', '/images/icons/rarities/d23.webp'),
        (lorcana_id, 'ES', 'ES', '/images/icons/rarities/es.webp'),
        (lorcana_id, 'GenCon', 'GC', '/images/icons/rarities/gencon.webp'),
        (lorcana_id, 'GamesCom', 'GS', '/images/icons/rarities/gamescom.webp'),
        (lorcana_id, 'D100', 'D100', '/images/icons/rarities/d100.webp'),
        (lorcana_id, 'Promo', 'PR', '/images/icons/rarities/promo.webp'),
        (lorcana_id, 'Spéciale', 'S', '/images/icons/rarities/s.webp'),
        (lorcana_id, 'DLC', 'DLC', '/images/icons/rarities/dlc.webp'),
        (lorcana_id, 'Parc', 'PC', '/images/icons/rarities/parc.webp'),
        (lorcana_id, 'Croisière', 'CR', '/images/icons/rarities/cruise.webp')
        ON CONFLICT (tcg_game_id, code) DO NOTHING;

        -- Insérer les encres Lorcana
        INSERT INTO public.inks (tcg_game_id, name, code, icon_url) VALUES
        (lorcana_id, 'Ambre', 'amber', '/images/icons/inks/amber.webp'),
        (lorcana_id, 'Améthyste', 'amethyst', '/images/icons/inks/amethyst.webp'),
        (lorcana_id, 'Émeraude', 'emerald', '/images/icons/inks/emerald.webp'),
        (lorcana_id, 'Rubis', 'ruby', '/images/icons/inks/ruby.webp'),
        (lorcana_id, 'Saphir', 'sapphire', '/images/icons/inks/sapphire.webp'),
        (lorcana_id, 'Acier', 'steel', '/images/icons/inks/steel.webp')
        ON CONFLICT (tcg_game_id, code) DO NOTHING;
    END IF;
END $$;
