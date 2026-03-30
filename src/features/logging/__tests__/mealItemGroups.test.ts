import { describe, expect, it } from 'vitest'
import { groupMealItemsByMealId } from '../mealItemGroups'

describe('groupMealItemsByMealId', () => {
  it('groups and maps meal items by meal id in one pass', () => {
    const grouped = groupMealItemsByMealId([
      {
        id: 'item-1',
        meal_id: 'meal-1',
        product_id: 'product-1',
        catalog_item_id: null,
        quantity: 1,
        product_name_snapshot: 'Eggs',
        calories_per_serving_snapshot: 150,
        protein_g_snapshot: 12,
        carbs_g_snapshot: 1,
        fat_g_snapshot: 10,
        serving_amount_snapshot: 2,
        serving_unit_snapshot: 'pcs',
        line_total_calories: 150,
        created_at: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'item-2',
        meal_id: 'meal-1',
        product_id: null,
        catalog_item_id: 'catalog-1',
        quantity: 2,
        product_name_snapshot: 'Toast',
        calories_per_serving_snapshot: 80,
        protein_g_snapshot: 3,
        carbs_g_snapshot: 15,
        fat_g_snapshot: 1,
        serving_amount_snapshot: 1,
        serving_unit_snapshot: 'slice',
        line_total_calories: 160,
        created_at: '2026-01-01T08:00:00.000Z',
      },
      {
        id: 'item-3',
        meal_id: 'meal-2',
        product_id: 'product-2',
        catalog_item_id: null,
        quantity: 1,
        product_name_snapshot: 'Yogurt',
        calories_per_serving_snapshot: 110,
        protein_g_snapshot: 10,
        carbs_g_snapshot: 8,
        fat_g_snapshot: 2,
        serving_amount_snapshot: 150,
        serving_unit_snapshot: 'g',
        line_total_calories: 110,
        created_at: '2026-01-01T12:00:00.000Z',
      },
    ])

    expect(Object.keys(grouped)).toEqual(['meal-1', 'meal-2'])
    expect(grouped['meal-1']).toHaveLength(2)
    expect(grouped['meal-1'][0]).toMatchObject({
      id: 'item-1',
      mealId: 'meal-1',
      productNameSnapshot: 'Eggs',
    })
    expect(grouped['meal-2'][0]).toMatchObject({
      id: 'item-3',
      mealId: 'meal-2',
      productNameSnapshot: 'Yogurt',
    })
  })
})
