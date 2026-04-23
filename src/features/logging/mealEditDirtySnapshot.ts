import { getItemKey } from '@/features/logging/itemHelpers'
import type { Item } from '@/features/logging/types'

/** Canonical JSON for dirty detection; ignores foodSource and snapshot display fields. */
export function serializeMealEditSnapshot(mealName: string, mealType: string, items: Item[]): string {
  return JSON.stringify({
    name: mealName.trim(),
    mealType,
    items: items.map((item) => ({
      k: getItemKey(item),
      q: item.quantity,
      m: item.compositeQuantityMode ?? null,
    })),
  })
}
