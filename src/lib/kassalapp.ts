const BASE_URL = 'https://kassal.app/api/v1'

export interface KassalappProduct {
  ean: string
  name: string
  brand: string | null
  imageUrl: string | null
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  labelPortionGrams: number | null
}

interface KassalappNutrient {
  code: string
  amount: number
  unit: string
  display_value: string
}

interface KassalappApiProduct {
  id: number
  name: string
  vendor: string | null
  brand: string | null
  description: string | null
  url: string | null
  image: string | null
  category: unknown
  allergens: unknown
  nutrition: KassalappNutrient[]
  weight: number | null
  weight_unit: string | null
  store: unknown
}

function getNutrient(nutrition: KassalappNutrient[] | null | undefined, ...codes: string[]): number | null {
  if (!nutrition?.length) return null
  for (const code of codes) {
    const found = nutrition.find((n) => n.code.toLowerCase() === code.toLowerCase())
    if (found != null) return found.amount
  }
  return null
}

function mapProduct(ean: string, raw: KassalappApiProduct): KassalappProduct {
  const nutrition = Array.isArray(raw.nutrition) ? raw.nutrition : []
  const kcal = getNutrient(nutrition, 'energi_kcal', 'energy_kcal', 'calories', 'energi') ?? 0
  const portionG =
    raw.weight && raw.weight_unit?.toLowerCase() === 'g' ? raw.weight : null

  return {
    ean,
    name: raw.name,
    brand: raw.brand ?? null,
    imageUrl: raw.image ?? null,
    caloriesPer100g: kcal,
    proteinPer100g: getNutrient(nutrition, 'protein'),
    carbsPer100g: getNutrient(nutrition, 'karbohydrater', 'karbohydrat', 'carbohydrates'),
    fatPer100g: getNutrient(nutrition, 'fett_totalt', 'fett', 'fat'),
    labelPortionGrams: portionG,
  }
}

export class KassalappError extends Error {
  readonly status: number | undefined
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'KassalappError'
    this.status = status
  }
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
}

export async function lookupBarcode(ean: string): Promise<KassalappProduct | null> {
  const token = import.meta.env.VITE_KASSALAPP_TOKEN as string | undefined
  if (!token) throw new KassalappError('VITE_KASSALAPP_TOKEN is not configured')

  // Step 1: barcode endpoint — returns name/brand/weight but never nutrition
  const eanRes = await fetch(`${BASE_URL}/products/ean/${encodeURIComponent(ean)}`, {
    headers: authHeaders(token),
  })
  if (eanRes.status === 404) return null
  if (!eanRes.ok) throw new KassalappError('Kassalapp API error', eanRes.status)

  const eanJson = await eanRes.json()
  const products: KassalappApiProduct[] | undefined = eanJson?.data?.products
  if (!products?.length) return null
  const raw = products[0]

  // Step 2: name search — returns nutrition; prefer match by EAN, fall back to first result
  let nutrition: KassalappNutrient[] = []
  try {
    const searchRes = await fetch(
      `${BASE_URL}/products?search=${encodeURIComponent(raw.name)}&size=5`,
      { headers: authHeaders(token) },
    )
    if (searchRes.ok) {
      const searchJson = await searchRes.json()
      const results: Array<KassalappApiProduct & { ean?: string }> = searchJson?.data ?? []
      const match = results.find((p) => p.ean === ean) ?? results[0]
      if (Array.isArray(match?.nutrition)) nutrition = match.nutrition
    }
  } catch {
    // nutrition enrichment is best-effort; proceed without it
  }

  return mapProduct(ean, { ...raw, nutrition })
}
