"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileSpreadsheet, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/providers/language-provider'
import type { CardItem } from '@/lib/types/cards'
import type { CollectionItem } from '@/lib/utils/excel-export'

// Mapping TCG slug to display name
const TCG_NAMES: Record<string, string> = {
  lorcana: 'Lorcana',
  pokemon: 'Pokemon',
  onepiece: 'One Piece',
  riftbound: 'Riftbound',
  naruto: 'Naruto'
}

interface ExportButtonProps {
  cards: CardItem[]
  seriesName: string
  seriesCode: string
  maxSetBase?: number
  masterSet?: number
  tcgSlug: string
  selectedLanguage?: string
  className?: string
}

export function ExportButton({
  cards,
  seriesName,
  seriesCode,
  maxSetBase,
  masterSet,
  tcgSlug,
  selectedLanguage = 'fr',
  className
}: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false)
  const { t } = useLanguage()

  const handleExport = async () => {
    if (isExporting) return

    setIsExporting(true)

    try {
      // 1. Get current user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        toast.error(t.export.notLoggedIn)
        return
      }

      // 2. Fetch ALL user's collection entries (no filter by card_id to avoid URL length limit)
      const { data: collectionData, error } = await supabase
        .from('user_collections')
        .select('card_id, quantity, quantity_foil')
        .eq('user_id', user.id)

      if (error) {
        console.error('Error fetching collection:', error)
        toast.error(t.export.error)
        return
      }

      // 3. Build collection map
      const collection: Record<string, CollectionItem> = {}
      collectionData?.forEach(item => {
        collection[item.card_id] = {
          quantity: item.quantity || 0,
          quantity_foil: item.quantity_foil || 0
        }
      })

      // 4. Dynamic import of xlsx to reduce initial bundle size
      const { generateCollectionExcel } = await import('@/lib/utils/excel-export')

      // 5. Generate and download Excel with site language translations
      generateCollectionExcel({
        cards,
        collection,
        seriesName,
        seriesCode,
        maxSetBase,
        masterSet,
        tcgName: TCG_NAMES[tcgSlug] || tcgSlug,
        preferredLanguage: selectedLanguage,
        translations: {
          sheets: t.export.sheets,
          headers: t.export.headers,
          stats: t.export.stats
        }
      })

      toast.success(t.export.success)
    } catch (error) {
      console.error('Export error:', error)
      toast.error(t.export.error)
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={isExporting}
      className={className}
      title={t.export.button}
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      <span className="hidden sm:inline ml-2">{t.export.button}</span>
    </Button>
  )
}
