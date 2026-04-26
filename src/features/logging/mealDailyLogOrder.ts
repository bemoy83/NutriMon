import type { Meal } from '@/types/domain'

/** Standard diary slots first (Breakfast…Snack), then Other / null / custom types by logged_at. */
const STANDARD_SLOT_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const

function mealDailyLogSortKey(meal: Meal): { tier: number; loggedAt: string; id: string } {
  const t = meal.mealType
  const idx = t ? (STANDARD_SLOT_ORDER as readonly string[]).indexOf(t) : -1
  if (idx >= 0) return { tier: idx, loggedAt: meal.loggedAt, id: meal.id }
  return { tier: STANDARD_SLOT_ORDER.length, loggedAt: meal.loggedAt, id: meal.id }
}

export function compareMealsForDailyLog(a: Meal, b: Meal): number {
  const ka = mealDailyLogSortKey(a)
  const kb = mealDailyLogSortKey(b)
  if (ka.tier !== kb.tier) return ka.tier - kb.tier
  if (ka.loggedAt !== kb.loggedAt) return ka.loggedAt.localeCompare(kb.loggedAt)
  return ka.id.localeCompare(kb.id)
}
