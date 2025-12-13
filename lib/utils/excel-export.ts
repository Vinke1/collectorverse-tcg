import * as XLSX from 'xlsx'
import type { CardItem } from '@/lib/types/cards'

export interface CollectionItem {
  quantity: number
  quantity_foil: number
}

export interface ExportTranslations {
  sheets: {
    complete: string
    myCollection: string
    missing: string
  }
  headers: {
    number: string
    name: string
    rarity: string
    language: string
    owned: string
    qtyNormal: string
    qtyFoil: string
    total: string
  }
  stats: {
    exportDate: string
    total: string
    owned: string
    missing: string
  }
}

export interface ExportData {
  cards: CardItem[]
  collection: Record<string, CollectionItem>
  seriesName: string
  seriesCode: string
  maxSetBase?: number
  masterSet?: number
  tcgName: string
  preferredLanguage?: string
  translations?: ExportTranslations
}

interface ExcelCard {
  numero: string
  nom: string
  rarete: string
  langue: string
  possede: string
  qteNormal: number
  qteFoil: number
  total: number
}

interface SheetStats {
  total: number
  owned: number
  percentage: number
}

/**
 * Transform a CardItem + collection info to Excel row format
 */
function cardToExcelRow(card: CardItem, collection: Record<string, CollectionItem>): ExcelCard {
  const collectionItem = collection[card.id] || { quantity: 0, quantity_foil: 0 }
  const qteNormal = collectionItem.quantity || 0
  const qteFoil = collectionItem.quantity_foil || 0
  const total = qteNormal + qteFoil

  return {
    numero: card.number,
    nom: card.name,
    rarete: card.rarity || '',
    langue: (card.language || 'FR').toUpperCase(),
    possede: total > 0 ? '✓' : '✗',
    qteNormal,
    qteFoil,
    total
  }
}

// Default translations (French)
const defaultTranslations: ExportTranslations = {
  sheets: {
    complete: 'Complet',
    myCollection: 'Ma Collection',
    missing: 'Manquantes'
  },
  headers: {
    number: 'N°',
    name: 'Nom',
    rarity: 'Rarete',
    language: 'Langue',
    owned: 'Possede',
    qtyNormal: 'Qte Normal',
    qtyFoil: 'Qte Foil',
    total: 'Total'
  },
  stats: {
    exportDate: 'Export du',
    total: 'Total',
    owned: 'Possedees',
    missing: 'Manquantes'
  }
}

/**
 * Create worksheet with header stats
 */
function createSheet(
  cards: ExcelCard[],
  sheetType: 'master' | 'owned' | 'missing',
  stats: SheetStats,
  seriesInfo: { name: string; code: string; tcg: string },
  t: ExportTranslations
): XLSX.WorkSheet {
  const today = new Date().toLocaleDateString('fr-FR')

  // Build header rows
  const headerRows = [
    [`${seriesInfo.tcg} - ${seriesInfo.name} (${seriesInfo.code})`],
    [`${t.stats.exportDate} ${today}`],
    sheetType === 'master'
      ? [`${t.stats.total}: ${stats.total} | ${t.stats.owned}: ${stats.owned} (${stats.percentage}%)`]
      : sheetType === 'owned'
        ? [`${t.stats.owned}: ${cards.length}`]
        : [`${t.stats.missing}: ${cards.length}`],
    [], // Empty row
    [t.headers.number, t.headers.name, t.headers.rarity, t.headers.language, t.headers.owned, t.headers.qtyNormal, t.headers.qtyFoil, t.headers.total]
  ]

  // Build data rows
  const dataRows = cards.map(card => [
    card.numero,
    card.nom,
    card.rarete,
    card.langue,
    card.possede,
    card.qteNormal,
    card.qteFoil,
    card.total
  ])

  // Combine all rows
  const allRows = [...headerRows, ...dataRows]

  // Create worksheet
  const ws = XLSX.utils.aoa_to_sheet(allRows)

  // Set column widths
  ws['!cols'] = [
    { wch: 10 },  // N°
    { wch: 40 },  // Nom
    { wch: 15 },  // Rareté
    { wch: 8 },   // Langue
    { wch: 8 },   // Possédé
    { wch: 10 },  // Qté Normal
    { wch: 10 },  // Qté Foil
    { wch: 8 }    // Total
  ]

  // Add auto-filter on header row (row 5, 0-indexed = 4)
  const lastRow = 4 + cards.length // Header row + data rows
  ws['!autofilter'] = { ref: `A5:H${lastRow + 1}` }

  return ws
}

/**
 * Trigger browser download of the workbook
 */
function downloadExcel(workbook: XLSX.WorkBook, filename: string): void {
  const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate and download Excel file with collection data
 */
export function generateCollectionExcel(data: ExportData): void {
  const { cards, collection, seriesName, seriesCode, tcgName, preferredLanguage = 'fr', translations } = data

  // Use provided translations or defaults
  const t = translations || defaultTranslations

  // Transform all cards to Excel format
  const excelCards = cards.map(card => cardToExcelRow(card, collection))

  // Sort cards: preferred language first, then alphabetically by language
  const preferredLangUpper = preferredLanguage.toUpperCase()
  excelCards.sort((a, b) => {
    // Preferred language comes first
    if (a.langue === preferredLangUpper && b.langue !== preferredLangUpper) return -1
    if (a.langue !== preferredLangUpper && b.langue === preferredLangUpper) return 1
    // Then sort by language alphabetically
    if (a.langue !== b.langue) return a.langue.localeCompare(b.langue)
    // Then by card number
    return a.numero.localeCompare(b.numero, undefined, { numeric: true })
  })

  // Calculate stats
  const ownedCards = excelCards.filter(c => c.total > 0)
  const missingCards = excelCards.filter(c => c.total === 0)

  const stats: SheetStats = {
    total: excelCards.length,
    owned: ownedCards.length,
    percentage: excelCards.length > 0
      ? Math.round((ownedCards.length / excelCards.length) * 100)
      : 0
  }

  const seriesInfo = {
    name: seriesName,
    code: seriesCode,
    tcg: tcgName
  }

  // Create workbook
  const wb = XLSX.utils.book_new()

  // Sheet 1: Complete (all cards)
  const wsMaster = createSheet(excelCards, 'master', stats, seriesInfo, t)
  XLSX.utils.book_append_sheet(wb, wsMaster, t.sheets.complete)

  // Sheet 2: My Collection (owned cards only)
  const wsOwned = createSheet(ownedCards, 'owned', stats, seriesInfo, t)
  XLSX.utils.book_append_sheet(wb, wsOwned, t.sheets.myCollection)

  // Sheet 3: Missing (missing cards)
  const wsMissing = createSheet(missingCards, 'missing', stats, seriesInfo, t)
  XLSX.utils.book_append_sheet(wb, wsMissing, t.sheets.missing)

  // Generate filename: SeriesName_Code_Date.xlsx
  const date = new Date().toISOString().split('T')[0]
  const safeSeriesName = seriesName.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeSeriesName}_${seriesCode}_${date}.xlsx`

  // Download
  downloadExcel(wb, filename)
}
