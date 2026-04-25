import { describe, expect, it } from 'vitest'
import { computeLiveKcalItemEdit } from '../servingDraftModel'
import type { Item } from '../types'

describe('computeLiveKcalItemEdit', () => {
  it('uses pending portions × label grams for snapshot-only items in portions mode (no foodSource)', () => {
    const item: Item = {
      productId: 'p1',
      snapshotName: 'Yogurt',
      snapshotCalories: 100,
      snapshotLabelPortionGrams: 150,
      quantity: 1,
    }
    // 2 portions × 150g = 300g total → 300 * (100/100) = 300 kcal
    expect(
      computeLiveKcalItemEdit(item, {
        pendingMode: 'grams',
        massInputMode: 'portions',
        pendingGrams: 200,
        pendingPortions: 2,
      }),
    ).toBe(300)

    // 1 portion: 150g → 150 kcal
    expect(
      computeLiveKcalItemEdit(item, {
        pendingMode: 'grams',
        massInputMode: 'portions',
        pendingGrams: 150,
        pendingPortions: 1,
      }),
    ).toBe(150)
  })

  it('uses pendingGrams in grams mode for snapshot-only items', () => {
    const item: Item = {
      productId: 'p1',
      snapshotName: 'Yogurt',
      snapshotCalories: 100,
      snapshotLabelPortionGrams: 150,
      quantity: 1,
    }
    expect(
      computeLiveKcalItemEdit(item, {
        pendingMode: 'grams',
        massInputMode: 'grams',
        pendingGrams: 200,
        pendingPortions: 1,
      }),
    ).toBe(200)
  })
})
