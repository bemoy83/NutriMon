export type SexForTDEE = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
export type EvaluationStatus = 'optimal' | 'acceptable' | 'poor' | 'no_data'
export type CreatureStage = 'baby' | 'adult' | 'champion'
export type WeightUnit = 'kg' | 'lb'

export interface Profile {
  userId: string
  heightCm: number | null
  startingWeightKg: number | null
  ageYears: number | null
  sexForTDEE: SexForTDEE | null
  activityLevel: ActivityLevel | null
  timezone: string | null
  calorieTarget: number | null
  goalWeightKg: number | null
  onboardingCompletedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Product {
  id: string
  userId: string
  name: string
  calories: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  defaultServingAmount: number | null
  defaultServingUnit: string | null
  useCount: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface FoodSource {
  sourceType: 'user_product' | 'catalog_item'
  sourceId: string
  name: string
  calories: number
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  defaultServingAmount: number | null
  defaultServingUnit: string | null
  useCount: number
  lastUsedAt: string | null
}

export interface DailyLog {
  id: string
  userId: string
  logDate: string
  totalCalories: number
  mealCount: number
  isFinalized: boolean
  finalizedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Meal {
  id: string
  userId: string
  dailyLogId: string
  loggedAt: string
  totalCalories: number
  itemCount: number
  createdAt: string
  updatedAt: string
  items?: MealItem[]
}

export interface MealItem {
  id: string
  mealId: string
  productId: string | null
  catalogItemId: string | null
  quantity: number
  productNameSnapshot: string
  caloriesPerServingSnapshot: number
  proteinGSnapshot: number | null
  carbsGSnapshot: number | null
  fatGSnapshot: number | null
  servingAmountSnapshot: number | null
  servingUnitSnapshot: string | null
  lineTotalCalories: number
  createdAt: string
}

export interface WeightEntry {
  id: string
  userId: string
  entryDate: string
  weightKg: number
  sourceUnit: WeightUnit
  sourceValue: number
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface DailyEvaluation {
  id: string
  userId: string
  dailyLogId: string
  logDate: string
  targetCalories: number
  consumedCalories: number
  calorieDelta: number
  adherenceScore: number
  adjustedAdherence: number
  status: EvaluationStatus
  calculationVersion: string
  finalizedAt: string
  createdAt: string
}

export interface HabitMetrics {
  id: string
  userId: string
  logDate: string
  currentStreak: number
  longestStreak: number
  daysLoggedLast7: number
  lastLogDate: string | null
  createdAt: string
}

export interface BehaviorAttributes {
  id: string
  userId: string
  logDate: string
  consistencyScore: number
  stabilityScore: number
  momentumScore: number
  disciplineScore: number
  calculationVersion: string
  calculatedAt: string
  createdAt: string
}

export interface CreatureStats {
  id: string
  userId: string
  logDate: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  stage: CreatureStage
  createdAt: string
}

export interface DailyFeedback {
  id: string
  userId: string
  logDate: string
  dailyEvaluationId: string
  status: EvaluationStatus
  message: string
  recommendation: string
  createdAt: string
}

export interface DailyLogView {
  dailyLog: DailyLog | null
  meals: Meal[]
  evaluation: DailyEvaluation | null
  habitMetrics: HabitMetrics | null
  behaviorAttributes: BehaviorAttributes | null
  creatureStats: CreatureStats | null
  feedback: DailyFeedback | null
}
