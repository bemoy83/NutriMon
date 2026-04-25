import type { Meal, MealItem } from '@/types/domain'
import type { Item } from './types'

function formatAmount(value: number): string {
  return Number.isInteger(value) ? String(value) : parseFloat(value.toFixed(2)).toString()
}

export function getItemKey(item: Item): string {
  if (item.productId) return `user_product:${item.productId}`
  if (item.catalogItemId) return `catalog_item:${item.catalogItemId}`
  return `snapshot:${item.mealItemId}`
}

export function getItemLabel(item: Item): string {
  if (item.foodSource) return item.foodSource.name
  if (item.snapshotName && (item.productId || item.catalogItemId)) return item.snapshotName
  if (item.snapshotName) return `${item.snapshotName} (deleted)`
  return 'Unknown'
}

export function getItemCalories(item: Item): number {
  if (item.foodSource) return item.foodSource.caloriesPer100g ?? item.foodSource.calories
  return item.snapshotCalories ?? 0
}

/** Stored quantity is multiples of 100 g (grams / 100); reference divisor is always 100. */
export function getItemServingAmount(): number {
  return 100
}

export function getItemSourceType(item: Item): 'user_product' | 'catalog_item' | null {
  if (item.foodSource) return item.foodSource.sourceType
  if (item.productId) return 'user_product'
  if (item.catalogItemId) return 'catalog_item'
  return null
}

export function formatMealItemServingLabel(
  item: Pick<MealItem, 'quantity' | 'servingAmountSnapshot' | 'servingUnitSnapshot'>,
): string {
  const unit = item.servingUnitSnapshot?.trim()
  if (!unit) return `×${formatAmount(item.quantity)}`
  if (unit.toLowerCase() !== 'g') return `${formatAmount(item.quantity)} ${unit}`

  const grams = item.servingAmountSnapshot
    ? item.quantity * item.servingAmountSnapshot
    : item.quantity
  return `${formatAmount(grams)}g`
}

/** Compute kcal for a single cart item, accounting for composite piece mode. */
export function getItemKcal(item: Item): number {
  if (item.compositeQuantityMode === 'pieces') {
    const fs = item.foodSource
    if (fs && fs.totalMassG && fs.pieceCount && fs.pieceCount > 0) {
      const gramsPerPiece = fs.totalMassG / fs.pieceCount
      return Math.round(item.quantity * (fs.calories / 100) * gramsPerPiece)
    }
  }
  return Math.round(item.quantity * getItemCalories(item))
}

export function initItemsFromMeal(meal: Meal): Item[] {
  return (meal.items ?? []).map((i): Item => {
    const compositeQuantityMode: 'grams' | 'pieces' | undefined =
      i.servingUnitSnapshot && i.servingUnitSnapshot !== 'g' ? 'pieces' : undefined

    if (i.productId || i.catalogItemId) {
      return {
        productId: i.productId ?? undefined,
        catalogItemId: i.catalogItemId ?? undefined,
        snapshotName: i.productNameSnapshot,
        snapshotCalories: i.caloriesPerServingSnapshot,
        snapshotProteinG: i.proteinGSnapshot,
        snapshotCarbsG: i.carbsGSnapshot,
        snapshotFatG: i.fatGSnapshot,
        snapshotServingAmount: i.servingAmountSnapshot,
        snapshotServingUnit: i.servingUnitSnapshot,
        snapshotLabelPortionGrams: i.labelPortionGramsSnapshot,
        quantity: i.quantity,
        compositeQuantityMode,
      }
    }

    return {
      mealItemId: i.id,
      snapshotName: i.productNameSnapshot,
      snapshotCalories: i.caloriesPerServingSnapshot,
      snapshotProteinG: i.proteinGSnapshot,
      snapshotCarbsG: i.carbsGSnapshot,
      snapshotFatG: i.fatGSnapshot,
      snapshotServingAmount: i.servingAmountSnapshot,
      snapshotServingUnit: i.servingUnitSnapshot,
      snapshotLabelPortionGrams: i.labelPortionGramsSnapshot,
      quantity: i.quantity,
      compositeQuantityMode,
    }
  })
}
