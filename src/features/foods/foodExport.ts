import { getUserProducts, getCompositeProductsBatch } from '@/features/foods/api'

interface ExportSimpleFood {
  kind: 'simple'
  name: string
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
  labelPortionGrams: number | null
}

interface ExportIngredient {
  name: string
  massG: number
  caloriesPer100g: number
  proteinPer100g: number | null
  carbsPer100g: number | null
  fatPer100g: number | null
}

interface ExportCompositeFood {
  kind: 'composite'
  name: string
  totalMassG: number
  pieceCount: number | null
  pieceLabel: string | null
  ingredients: ExportIngredient[]
}

interface FoodExportPayload {
  version: 1
  exportedAt: string
  foods: (ExportSimpleFood | ExportCompositeFood)[]
}

export async function exportUserFoods(userId: string): Promise<void> {
  const products = await getUserProducts(userId)

  const compositeIds = products.filter((p) => p.kind === 'composite').map((p) => p.id)
  const compositeMap = await getCompositeProductsBatch(compositeIds)

  const foods: FoodExportPayload['foods'] = products.map((product) => {
    if (product.kind === 'composite') {
      const detail = compositeMap.get(product.id)
      return {
        kind: 'composite',
        name: product.name,
        totalMassG: detail?.totalMassG ?? product.totalMassG ?? 0,
        pieceCount: product.pieceCount,
        pieceLabel: product.pieceLabel,
        ingredients: (detail?.ingredients ?? []).map((ing) => ({
          name: ing.name,
          massG: ing.massG,
          caloriesPer100g: ing.caloriesPer100g,
          proteinPer100g: ing.proteinPer100g,
          carbsPer100g: ing.carbsPer100g,
          fatPer100g: ing.fatPer100g,
        })),
      } satisfies ExportCompositeFood
    }

    return {
      kind: 'simple',
      name: product.name,
      caloriesPer100g: product.caloriesPer100g ?? product.calories,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      labelPortionGrams: product.labelPortionGrams,
    } satisfies ExportSimpleFood
  })

  const payload: FoodExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    foods,
  }

  const json = JSON.stringify(payload, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `nutrimon-foods-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}
