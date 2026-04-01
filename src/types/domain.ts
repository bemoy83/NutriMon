export type SexForTDEE = 'male' | 'female'
export type ActivityLevel = 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active'
export type EvaluationStatus = 'optimal' | 'acceptable' | 'poor' | 'no_data'
export type CreatureStage = 'baby' | 'adult' | 'champion'
export type CreatureCondition = 'thriving' | 'steady' | 'recovering' | 'quiet'
export type ReadinessBand = 'recovering' | 'building' | 'ready' | 'peak'
export type MealRating = 'strong' | 'solid' | 'weak'
export type BattleLikelyOutcome = 'favored' | 'competitive' | 'risky'
export type BattleOutcome = 'pending' | 'win' | 'loss'
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
  mealType: string | null
  mealName: string | null
  totalCalories: number
  itemCount: number
  createdAt: string
  updatedAt: string
  items?: MealItem[]
}

export interface MealTemplateItem {
  id: string
  templateId: string
  productId: string | null
  catalogItemId: string | null
  quantity: number
  nameSnapshot: string
  caloriesSnapshot: number
  servingAmountSnapshot: number | null
  servingUnitSnapshot: string | null
  createdAt: string
}

export interface MealTemplate {
  id: string
  userId: string
  name: string
  defaultMealType: string | null
  useCount: number
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  items: MealTemplateItem[]
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

export interface CreatureCompanion {
  userId: string
  name: string
  stage: CreatureStage
  level: number
  xp: number
  currentCondition: CreatureCondition
  hatchedAt: string
  evolvedToAdultAt: string | null
  evolvedToChampionAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreatureBattleSnapshot {
  id: string
  userId: string
  prepDate: string
  battleDate: string
  strength: number
  resilience: number
  momentum: number
  vitality: number
  readinessScore: number
  readinessBand: ReadinessBand
  condition: CreatureCondition
  level: number
  stage: CreatureStage
  sourceDailyEvaluationId: string
  xpGained: number
  createdAt: string
}

export interface CreaturePreview {
  tomorrowReadinessScore: number
  tomorrowReadinessBand: ReadinessBand
  projectedStrength: number
  projectedResilience: number
  projectedMomentum: number
  projectedVitality: number
  mealRating: MealRating
  mealFeedbackMessage: string
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

export interface BattleRecommendation {
  opponentId: string
  name: string
  archetype: string
  recommendedLevel: number
  likelyOutcome: BattleLikelyOutcome
}

export interface BattlePrepSummary {
  prepDate: string
  battleDate: string
  snapshotId: string
  readinessScore: number
  readinessBand: ReadinessBand
  condition: CreatureCondition
  recommendedOpponent: BattleRecommendation | null
  xpGained: number
}

export interface BattleArena {
  id: string
  arenaKey: string
  name: string
  description: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
}

export interface BattleOpponent {
  id: string
  arenaId: string
  name: string
  archetype: string
  recommendedLevel: number
  strength: number
  resilience: number
  momentum: number
  vitality: number
  sortOrder: number
  unlockLevel: number
  isActive: boolean
  createdAt: string
}

export interface BattleRun {
  id: string
  userId: string
  battleDate: string
  snapshotId: string
  opponentId: string
  outcome: BattleOutcome
  turnCount: number | null
  remainingHpPct: number | null
  xpAwarded: number
  arenaProgressAwarded: number
  rewardClaimed: boolean
  createdAt: string
  opponent?: BattleOpponent | null
}

export interface BattleHub {
  companion: CreatureCompanion | null
  snapshot: CreatureBattleSnapshot | null
  recommendedOpponent: BattleRecommendation | null
  unlockedOpponents: BattleOpponent[]
  battleHistory: BattleRun[]
}

export interface FinalizeDayResponse {
  daily_log: Record<string, unknown>
  evaluation: Record<string, unknown> | null
  habit_metrics: Record<string, unknown> | null
  behavior_attributes: Record<string, unknown> | null
  creature_stats: Record<string, unknown> | null
  daily_feedback: Record<string, unknown> | null
  battle_prep?: {
    prep_date: string
    battle_date: string
    snapshot_id: string
    readiness_score: number
    readiness_band: ReadinessBand
    condition: CreatureCondition
    recommended_opponent: {
      opponent_id: string
      name: string
      archetype: string
      recommended_level: number
      likely_outcome: BattleLikelyOutcome
    } | null
    xp_gained: number
  } | null
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
