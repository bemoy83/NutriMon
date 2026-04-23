import { describe, expect, it } from 'vitest'
import { serializeMealEditSnapshot } from '@/features/logging/mealEditDirtySnapshot'
import type { Item } from '@/features/logging/types'

describe('serializeMealEditSnapshot', () => {
  it('ignores foodSource so hydration merge does not affect the fingerprint', () => {
    const base: Item = {
      productId: 'p1',
      quantity: 1,
      snapshotName: 'Oats',
    }
    const withSource: Item = {
      ...base,
      foodSource: {
        sourceType: 'user_product',
        sourceId: 'p1',
        name: 'Oats',
        calories: 100,
        caloriesPer100g: 100,
        proteinG: 10,
        carbsG: 50,
        fatG: 5,
        defaultServingAmount: 100,
        defaultServingUnit: 'g',
        labelPortionGrams: null,
        useCount: 0,
        lastUsedAt: null,
        kind: 'simple',
        pieceCount: null,
        pieceLabel: null,
        totalMassG: null,
      },
    }
    expect(serializeMealEditSnapshot('Bowl', 'Breakfast', [base])).toEqual(
      serializeMealEditSnapshot('Bowl', 'Breakfast', [withSource]),
    )
  })

  it('treats trailing spaces in the meal name like the save payload', () => {
    expect(serializeMealEditSnapshot('  Hi  ', 'Lunch', [])).toEqual(
      serializeMealEditSnapshot('Hi', 'Lunch', []),
    )
  })
})
