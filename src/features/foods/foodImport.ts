import { z } from 'zod'
import { getUserProducts, insertSimpleProduct, upsertCompositeProduct } from '@/features/foods/api'

const ingredientSchema = z.object({
  name: z.string().min(1),
  massG: z.number().positive(),
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0).nullable(),
  carbsPer100g: z.number().min(0).nullable(),
  fatPer100g: z.number().min(0).nullable(),
})

const simpleFoodSchema = z.object({
  kind: z.literal('simple'),
  name: z.string().min(1),
  caloriesPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0).nullable(),
  carbsPer100g: z.number().min(0).nullable(),
  fatPer100g: z.number().min(0).nullable(),
  labelPortionGrams: z.number().positive().nullable(),
})

const compositeFoodSchema = z.object({
  kind: z.literal('composite'),
  name: z.string().min(1),
  totalMassG: z.number().positive(),
  pieceCount: z.number().int().positive().nullable(),
  pieceLabel: z.string().nullable(),
  ingredients: z.array(ingredientSchema).min(1),
})

const exportPayloadSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  foods: z.array(z.discriminatedUnion('kind', [simpleFoodSchema, compositeFoodSchema])),
})

export interface ImportResult {
  created: number
  skipped: number
  errors: { name: string; reason: string }[]
}

export async function importUserFoods(file: File, userId: string): Promise<ImportResult> {
  let raw: unknown
  try {
    const text = await file.text()
    raw = JSON.parse(text)
  } catch {
    throw new Error('Could not read file. Make sure it is a valid NutriMon export.')
  }

  const parsed = exportPayloadSchema.safeParse(raw)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    if (firstIssue?.path[0] === 'version') {
      throw new Error('This file was exported from a newer version of NutriMon.')
    }
    throw new Error('Could not read file. Make sure it is a valid NutriMon export.')
  }

  const { foods } = parsed.data
  const result: ImportResult = { created: 0, skipped: 0, errors: [] }

  // Build existing product name set (case-insensitive)
  const existingProducts = await getUserProducts(userId)
  const existingNames = new Map<string, string>() // lowercase name → product id
  for (const p of existingProducts) {
    existingNames.set(p.name.toLowerCase(), p.id)
  }

  // name → product id map for both existing and newly imported products
  const nameToId = new Map<string, string>(existingNames)

  const simpleFoods = foods.filter((f) => f.kind === 'simple')
  const compositeFoods = foods.filter((f) => f.kind === 'composite')

  // Pass 1: import simple foods
  for (const food of simpleFoods) {
    const key = food.name.toLowerCase()
    if (nameToId.has(key)) {
      result.skipped++
      continue
    }
    try {
      const id = await insertSimpleProduct({
        userId,
        name: food.name,
        caloriesPer100g: food.caloriesPer100g,
        proteinPer100g: food.proteinPer100g,
        carbsPer100g: food.carbsPer100g,
        fatPer100g: food.fatPer100g,
        labelPortionGrams: food.labelPortionGrams,
      })
      nameToId.set(key, id)
      result.created++
    } catch (err) {
      result.errors.push({ name: food.name, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Pass 2: ensure every composite ingredient exists as a product
  const allIngredients = compositeFoods.flatMap((f) => f.ingredients)
  const seenIngredientNames = new Set<string>()
  for (const ing of allIngredients) {
    const key = ing.name.toLowerCase()
    if (nameToId.has(key) || seenIngredientNames.has(key)) continue
    seenIngredientNames.add(key)
    try {
      const id = await insertSimpleProduct({
        userId,
        name: ing.name,
        caloriesPer100g: ing.caloriesPer100g,
        proteinPer100g: ing.proteinPer100g,
        carbsPer100g: ing.carbsPer100g,
        fatPer100g: ing.fatPer100g,
        labelPortionGrams: null,
      })
      nameToId.set(key, id)
      result.created++
    } catch (err) {
      result.errors.push({ name: ing.name, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  // Pass 3: import composite foods
  for (const food of compositeFoods) {
    const key = food.name.toLowerCase()
    if (nameToId.has(key) && existingNames.has(key)) {
      result.skipped++
      continue
    }
    // Resolve each ingredient to a product id
    const resolvedIngredients: { product_id: string; catalog_item_id: null; mass_g: number; sort_order: number }[] = []
    let ingredientError = false
    for (let i = 0; i < food.ingredients.length; i++) {
      const ing = food.ingredients[i]
      const productId = nameToId.get(ing.name.toLowerCase())
      if (!productId) {
        result.errors.push({ name: food.name, reason: `Ingredient "${ing.name}" could not be resolved.` })
        ingredientError = true
        break
      }
      resolvedIngredients.push({ product_id: productId, catalog_item_id: null, mass_g: ing.massG, sort_order: i })
    }
    if (ingredientError) continue

    try {
      await upsertCompositeProduct({
        productId: null,
        name: food.name,
        totalMassG: food.totalMassG,
        pieceCount: food.pieceCount,
        pieceLabel: food.pieceLabel,
        ingredients: resolvedIngredients,
      })
      result.created++
    } catch (err) {
      result.errors.push({ name: food.name, reason: err instanceof Error ? err.message : 'Unknown error' })
    }
  }

  return result
}
