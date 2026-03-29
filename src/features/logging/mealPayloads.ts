import type { Meal } from '@/types/domain'
import type { MealItemUpdateInput, RestoreMealSnapshotItemInput } from '@/types/database'

export function buildMealUpdateItems(meal: Meal): MealItemUpdateInput[] {
  return (meal.items ?? []).map((item) => {
    if (item.productId) {
      return {
        product_id: item.productId,
        quantity: item.quantity,
      }
    }

    return {
      meal_item_id: item.id,
      quantity: item.quantity,
      product_name_snapshot: item.productNameSnapshot,
      calories_per_serving_snapshot: item.caloriesPerServingSnapshot,
      protein_g_snapshot: item.proteinGSnapshot,
      carbs_g_snapshot: item.carbsGSnapshot,
      fat_g_snapshot: item.fatGSnapshot,
      serving_amount_snapshot: item.servingAmountSnapshot,
      serving_unit_snapshot: item.servingUnitSnapshot,
    }
  })
}

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
