export interface SpreadsheetFoodRow {
  sourceItemId: string
  name: string
  ediblePortionPercent: string
  calories: string
  fatG: string
  carbsG: string
  proteinG: string
}

export interface NormalizedFoodCatalogItem {
  id: string
  source: 'matvaretabellen_2026'
  source_item_id: string
  name: string
  calories: number
  protein_g: number | null
  carbs_g: number | null
  fat_g: number | null
  default_serving_amount: number
  default_serving_unit: 'g'
  edible_portion_percent: number | null
}

const MATVARE_SOURCE = 'matvaretabellen_2026' as const

function parseNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const normalized = value.replace(',', '.').trim()
  if (normalized === '') return null
  const numeric = Number(normalized)
  return Number.isFinite(numeric) ? numeric : null
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

export function isLikelySpreadsheetFoodRow(row: Partial<SpreadsheetFoodRow>): row is SpreadsheetFoodRow {
  return Boolean(
    row.sourceItemId &&
    /^\d{2}\.\d{3}$/.test(row.sourceItemId.trim()) &&
    row.name &&
    normalizeName(row.name).length > 0 &&
    row.calories &&
    parseNumber(row.calories) !== null,
  )
}

export function normalizeFoodCatalogRows(rows: Partial<SpreadsheetFoodRow>[]): NormalizedFoodCatalogItem[] {
  return rows
    .filter(isLikelySpreadsheetFoodRow)
    .map((row) => ({
      id: `${MATVARE_SOURCE}:${row.sourceItemId.trim()}`,
      source: MATVARE_SOURCE,
      source_item_id: row.sourceItemId.trim(),
      name: normalizeName(row.name),
      calories: Math.round(parseNumber(row.calories) ?? 0),
      protein_g: parseNumber(row.proteinG),
      carbs_g: parseNumber(row.carbsG),
      fat_g: parseNumber(row.fatG),
      default_serving_amount: 100,
      default_serving_unit: 'g' as const,
      edible_portion_percent: parseNumber(row.ediblePortionPercent),
    }))
    .sort((a, b) => a.id.localeCompare(b.id, 'nb'))
}
