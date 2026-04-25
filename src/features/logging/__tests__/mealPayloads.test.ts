import { describe, expect, it } from 'vitest'
import { buildMealSnapshotItems, buildMealUpdateItemsFromEditableItems } from '../mealPayloads'
import type { Meal } from '@/types/domain'
import type { Item } from '../types'

const meal: Meal = {
  id: 'meal-1',
  userId: 'user-1',
  dailyLogId: 'log-1',
  loggedAt: '2026-01-05T08:30:00.000Z',
  mealType: null,
  mealName: null,
  totalCalories: 520,
  itemCount: 2,
  createdAt: '2026-01-05T08:30:00.000Z',
  updatedAt: '2026-01-05T08:30:00.000Z',
  items: [
    {
      id: 'item-active',
      mealId: 'meal-1',
      productId: 'product-1',
      catalogItemId: null,
      quantity: 1.5,
      productNameSnapshot: 'Greek Yogurt',
      caloriesPerServingSnapshot: 120,
      proteinGSnapshot: 10,
      carbsGSnapshot: 8,
      fatGSnapshot: 3,
      servingAmountSnapshot: 150,
      servingUnitSnapshot: 'g',
      labelPortionGramsSnapshot: null,
      lineTotalCalories: 180,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
    {
      id: 'item-catalog',
      mealId: 'meal-1',
      productId: null,
      catalogItemId: 'matvaretabellen_2026:01.344',
      quantity: 1,
      productNameSnapshot: 'Appenzeller, ost',
      caloriesPerServingSnapshot: 383,
      proteinGSnapshot: 24.3,
      carbsGSnapshot: 0,
      fatGSnapshot: 31.7,
      servingAmountSnapshot: 100,
      servingUnitSnapshot: 'g',
      labelPortionGramsSnapshot: null,
      lineTotalCalories: 383,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
    {
      id: 'item-deleted',
      mealId: 'meal-1',
      productId: null,
      catalogItemId: null,
      quantity: 2,
      productNameSnapshot: 'Deleted Granola',
      caloriesPerServingSnapshot: 170,
      proteinGSnapshot: 5,
      carbsGSnapshot: 20,
      fatGSnapshot: 7,
      servingAmountSnapshot: 50,
      servingUnitSnapshot: 'g',
      labelPortionGramsSnapshot: null,
      lineTotalCalories: 340,
      createdAt: '2026-01-05T08:30:00.000Z',
    },
  ],
}

describe('meal payload builders', () => {
  it('builds snapshot-only restore items for delete undo', () => {
    expect(buildMealSnapshotItems(meal)).toEqual([
      {
        quantity: 1.5,
        product_name_snapshot: 'Greek Yogurt',
        calories_per_serving_snapshot: 120,
        protein_g_snapshot: 10,
        carbs_g_snapshot: 8,
        fat_g_snapshot: 3,
        serving_amount_snapshot: 150,
        serving_unit_snapshot: 'g',
      },
      {
        quantity: 1,
        product_name_snapshot: 'Appenzeller, ost',
        calories_per_serving_snapshot: 383,
        protein_g_snapshot: 24.3,
        carbs_g_snapshot: 0,
        fat_g_snapshot: 31.7,
        serving_amount_snapshot: 100,
        serving_unit_snapshot: 'g',
      },
      {
        quantity: 2,
        product_name_snapshot: 'Deleted Granola',
        calories_per_serving_snapshot: 170,
        protein_g_snapshot: 5,
        carbs_g_snapshot: 20,
        fat_g_snapshot: 7,
        serving_amount_snapshot: 50,
        serving_unit_snapshot: 'g',
      },
    ])
  })

  it('builds update payload lines from editable items (product, catalog, snapshot-only)', () => {
    const items: Item[] = [
      {
        productId: 'p1',
        quantity: 1.2,
        compositeQuantityMode: 'grams',
      },
      {
        catalogItemId: 'c1',
        quantity: 0.5,
      },
      {
        mealItemId: 'mi1',
        quantity: 2,
        snapshotName: 'Gone',
        snapshotCalories: 100,
        snapshotProteinG: 1,
        snapshotCarbsG: 2,
        snapshotFatG: 3,
        snapshotServingAmount: 50,
        snapshotServingUnit: 'g',
      },
    ]
    expect(buildMealUpdateItemsFromEditableItems(items)).toEqual([
      { product_id: 'p1', quantity: 1.2, composite_quantity_mode: 'grams' },
      { catalog_item_id: 'c1', quantity: 0.5 },
      {
        meal_item_id: 'mi1',
        quantity: 2,
        product_name_snapshot: 'Gone',
        calories_per_serving_snapshot: 100,
        protein_g_snapshot: 1,
        carbs_g_snapshot: 2,
        fat_g_snapshot: 3,
        serving_amount_snapshot: 50,
        serving_unit_snapshot: 'g',
      },
    ])
  })
})
