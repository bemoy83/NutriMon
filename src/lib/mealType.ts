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
    bg: 'var(--app-surface-amber)',
    text: 'var(--app-surface-amber-text)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-surface-amber)',
    pillActiveText: 'var(--app-surface-amber-text)',
    accent: 'var(--app-surface-amber)',
  },
  Lunch: {
    bg: 'var(--app-surface-green)',
    text: 'var(--app-surface-green-text)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-surface-green)',
    pillActiveText: 'var(--app-surface-green-text)',
    accent: 'var(--app-surface-green)',
  },
  Dinner: {
    bg: 'var(--app-surface-blue)',
    text: 'var(--app-surface-blue-text)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-surface-blue)',
    pillActiveText: 'var(--app-surface-blue-text)',
    accent: 'var(--app-surface-blue)',
  },
  Snack: {
    bg: 'var(--app-surface-purple)',
    text: 'var(--app-surface-purple-text)',
    divider: 'rgba(0,0,0,0.08)',
    pillActiveBg: 'var(--app-surface-purple)',
    pillActiveText: 'var(--app-surface-purple-text)',
    accent: 'var(--app-surface-purple)',
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
