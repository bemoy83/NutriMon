// Scoring thresholds
export const STREAK_THRESHOLD = 70
export const OPTIMAL_THRESHOLD = 90
export const ACCEPTABLE_THRESHOLD = 70

// Creature evolution streaks
export const QUALIFYING_STREAK_DAYS_FOR_ADULT = 7
export const QUALIFYING_STREAK_DAYS_FOR_CHAMPION = 30

// Calorie target bounds
export const CALORIE_TARGET_MIN = 800
export const CALORIE_TARGET_MAX = 6000
export const SUGGESTED_TARGET_MIN = 1200
export const SUGGESTED_TARGET_MAX = 4000

// TDEE deficit
export const TDEE_DEFICIT = 500

// Activity multipliers
export const ACTIVITY_MULTIPLIERS = {
  sedentary: 1.2,
  lightly_active: 1.375,
  moderately_active: 1.55,
  very_active: 1.725,
} as const

// Creature stat bounds
export const CREATURE_STAT_MIN = 0
export const CREATURE_STAT_MAX = 100
export const VITALITY_BASE = 50
export const VITALITY_MIN = 50
export const VITALITY_MAX = 999

// Scoring calculation version
export const CALCULATION_VERSION = 'v1'

// Undo toast duration (ms)
export const UNDO_TOAST_DURATION = 5000

// Product query limits
export const RECENT_PRODUCTS_LIMIT = 20
export const FREQUENT_PRODUCTS_LIMIT = 10
export const SEARCH_PRODUCTS_LIMIT = 20
