import type { MealItem } from '@/types/domain'
import type { MealItemRow } from '@/types/database'
import { mapMealItem } from '@/lib/domainMappers'

export function groupMealItemsByMealId(rows: MealItemRow[] | null | undefined): Record<string, MealItem[]> {
  return (rows ?? []).reduce<Record<string, MealItem[]>>((acc, row) => {
    const key = row.meal_id
    if (!acc[key]) acc[key] = []
    acc[key].push(mapMealItem(row))
    return acc
  }, {})
}
