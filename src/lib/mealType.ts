export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Other'] as const
export type MealType = (typeof MEAL_TYPES)[number]

export type MealTypeTheme = {
  bg: string
  text: string
  divider: string
  pillActiveBg: string
  pillActiveText: string
  accent: string
}

const MEAL_TYPE_THEMES: Record<MealType, MealTypeTheme | null> = {
  Breakfast: {
    bg: 'var(--app-meal-breakfast-bg)',
    text: 'var(--app-meal-breakfast)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-meal-breakfast-bg)',
    pillActiveText: 'var(--app-meal-breakfast)',
    accent: 'var(--app-meal-breakfast)',
  },
  Lunch: {
    bg: 'var(--app-meal-lunch-bg)',
    text: 'var(--app-meal-lunch)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-meal-lunch-bg)',
    pillActiveText: 'var(--app-meal-lunch)',
    accent: 'var(--app-meal-lunch)',
  },
  Dinner: {
    bg: 'var(--app-meal-dinner-bg)',
    text: 'var(--app-meal-dinner)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-meal-dinner-bg)',
    pillActiveText: 'var(--app-meal-dinner)',
    accent: 'var(--app-meal-dinner)',
  },
  Snack: {
    bg: 'var(--app-meal-snack-bg)',
    text: 'var(--app-meal-snack)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-meal-snack-bg)',
    pillActiveText: 'var(--app-meal-snack)',
    accent: 'var(--app-meal-snack)',
  },
  Other: null,
}

export function getMealTypeTheme(type: MealType | string | null | undefined): MealTypeTheme | null {
  if (!type) return null
  return MEAL_TYPE_THEMES[type as MealType] ?? null
}

export function getDefaultMealType(loggedAt: string): MealType {
  const hour = new Date(loggedAt).getHours()
  if (hour < 10) return 'Breakfast'
  if (hour < 14) return 'Lunch'
  if (hour < 17) return 'Snack'
  if (hour < 21) return 'Dinner'
  return 'Snack'
}
