import type { Meal } from '@/types/domain'
import type { MealItemUpdateInput, RestoreMealSnapshotItemInput } from '@/types/database'
import type { Item } from './types'

export function buildMealSnapshotItems(meal: Meal): RestoreMealSnapshotItemInput[] {
  return (meal.items ?? []).map((item) => ({
    quantity: item.quantity,
    product_name_snapshot: item.productNameSnapshot,
    calories_per_serving_snapshot: item.caloriesPerServingSnapshot,
    protein_g_snapshot: item.proteinGSnapshot,
    carbs_g_snapshot: item.carbsGSnapshot,
    fat_g_snapshot: item.fatGSnapshot,
    serving_amount_snapshot: item.servingAmountSnapshot,
    serving_unit_snapshot: item.servingUnitSnapshot,
  }))
}

/**
 * API payload for `updateMealWithItems` from in-memory editable `Item` rows (slot card editor).
 */
export function buildMealUpdateItemsFromEditableItems(items: Item[]): MealItemUpdateInput[] {
  return items.map((item) => {
    if (item.productId) {
      return {
        product_id: item.productId,
        quantity: item.quantity,
        ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
      }
    }

    if (item.catalogItemId) {
      return {
        catalog_item_id: item.catalogItemId,
        quantity: item.quantity,
        ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
      }
    }

    return {
      meal_item_id: item.mealItemId,
      quantity: item.quantity,
      ...(item.compositeQuantityMode && { composite_quantity_mode: item.compositeQuantityMode }),
      product_name_snapshot: item.snapshotName,
      calories_per_serving_snapshot: item.snapshotCalories,
      protein_g_snapshot: item.snapshotProteinG,
      carbs_g_snapshot: item.snapshotCarbsG,
      fat_g_snapshot: item.snapshotFatG,
      serving_amount_snapshot: item.snapshotServingAmount,
      serving_unit_snapshot: item.snapshotServingUnit,
    }
  })
}
