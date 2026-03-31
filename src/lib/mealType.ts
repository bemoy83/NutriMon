export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export function getDefaultMealType(loggedAt: string): MealType {
  const hour = new Date(loggedAt).getHours()
  if (hour < 10) return 'Breakfast'
  if (hour < 14) return 'Lunch'
  if (hour < 17) return 'Snack'
  if (hour < 21) return 'Dinner'
  return 'Snack'
}
