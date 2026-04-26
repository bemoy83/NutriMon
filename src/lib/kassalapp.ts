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

function getNutrient(nutrition: KassalappNutrient[], ...codes: string[]): number | null {
  for (const code of codes) {
    const found = nutrition.find((n) => n.code.toLowerCase() === code.toLowerCase())
    if (found != null) return found.amount
  }
  return null
}

function mapProduct(ean: string, raw: KassalappApiProduct): KassalappProduct {
  const kcal = getNutrient(raw.nutrition, 'energi_kcal', 'energy_kcal', 'calories', 'energi') ?? 0
  const portionG =
    raw.weight && raw.weight_unit?.toLowerCase() === 'g' ? raw.weight : null

  return {
    ean,
    name: raw.name,
    brand: raw.brand ?? null,
    imageUrl: raw.image ?? null,
    caloriesPer100g: kcal,
    proteinPer100g: getNutrient(raw.nutrition, 'protein'),
    carbsPer100g: getNutrient(raw.nutrition, 'karbohydrat', 'carbohydrates', 'carbs'),
    fatPer100g: getNutrient(raw.nutrition, 'fett', 'fat'),
    labelPortionGrams: portionG,
  }
}

export class KassalappError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message)
    this.name = 'KassalappError'
  }
}

export async function lookupBarcode(ean: string): Promise<KassalappProduct | null> {
  const token = import.meta.env.VITE_KASSALAPP_TOKEN as string | undefined
  if (!token) throw new KassalappError('VITE_KASSALAPP_TOKEN is not configured')

  const res = await fetch(`${BASE_URL}/products/ean/${encodeURIComponent(ean)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })

  if (res.status === 404) return null
  if (!res.ok) throw new KassalappError(`Kassalapp API error`, res.status)

  const json = await res.json()
  const products: KassalappApiProduct[] | undefined = json?.data?.products
  if (!products?.length) return null

  return mapProduct(ean, products[0])
}
