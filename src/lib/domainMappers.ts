import type {
  BehaviorAttributes,
  CreatureStats,
  DailyEvaluation,
  DailyFeedback,
  DailyLog,
  FoodSource,
  HabitMetrics,
  Meal,
  MealItem,
  Product,
  Profile,
  WeightEntry,
} from '@/types/domain'
import type {
  BehaviorAttributesRow,
  CreatureStatsRow,
  DailyEvaluationRow,
  DailyFeedbackRow,
  DailyLogRow,
  FoodSourceRow,
  HabitMetricsRow,
  MealItemRow,
  MealRow,
  ProductRow,
  ProfileRow,
  WeightEntryRow,
} from '@/types/database'

export function mapProfile(row: ProfileRow): Profile {
  return {
    userId: row.user_id,
    heightCm: row.height_cm,
    startingWeightKg: row.starting_weight_kg,
    ageYears: row.age_years,
    sexForTDEE: row.sex_for_tdee,
    activityLevel: row.activity_level,
    timezone: row.timezone,
    calorieTarget: row.calorie_target,
    goalWeightKg: row.goal_weight_kg,
    onboardingCompletedAt: row.onboarding_completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    defaultServingAmount: row.default_serving_amount,
    defaultServingUnit: row.default_serving_unit,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapFoodSource(row: FoodSourceRow): FoodSource {
  return {
    sourceType: row.source_type,
    sourceId: row.source_id,
    name: row.name,
    calories: row.calories,
    proteinG: row.protein_g,
    carbsG: row.carbs_g,
    fatG: row.fat_g,
    defaultServingAmount: row.default_serving_amount,
    defaultServingUnit: row.default_serving_unit,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
  }
}

export function mapDailyLog(row: DailyLogRow): DailyLog {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    totalCalories: row.total_calories,
    mealCount: row.meal_count,
    isFinalized: row.is_finalized,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapMealItem(row: MealItemRow): MealItem {
  return {
    id: row.id,
    mealId: row.meal_id,
    productId: row.product_id,
    catalogItemId: row.catalog_item_id,
    quantity: row.quantity,
    productNameSnapshot: row.product_name_snapshot,
    caloriesPerServingSnapshot: row.calories_per_serving_snapshot,
    proteinGSnapshot: row.protein_g_snapshot,
    carbsGSnapshot: row.carbs_g_snapshot,
    fatGSnapshot: row.fat_g_snapshot,
    servingAmountSnapshot: row.serving_amount_snapshot,
    servingUnitSnapshot: row.serving_unit_snapshot,
    lineTotalCalories: row.line_total_calories,
    createdAt: row.created_at,
  }
}

export function mapMeal(row: MealRow, items: MealItem[] = []): Meal {
  return {
    id: row.id,
    userId: row.user_id,
    dailyLogId: row.daily_log_id,
    loggedAt: row.logged_at,
    mealType: row.meal_type ?? null,
    totalCalories: row.total_calories,
    itemCount: row.item_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  }
}

export function mapDailyEvaluation(row: DailyEvaluationRow): DailyEvaluation {
  return {
    id: row.id,
    userId: row.user_id,
    dailyLogId: row.daily_log_id,
    logDate: row.log_date,
    targetCalories: row.target_calories,
    consumedCalories: row.consumed_calories,
    calorieDelta: row.calorie_delta,
    adherenceScore: row.adherence_score,
    adjustedAdherence: row.adjusted_adherence,
    status: row.status,
    calculationVersion: row.calculation_version,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
  }
}

export function mapHabitMetrics(row: HabitMetricsRow): HabitMetrics {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    currentStreak: row.current_streak,
    longestStreak: row.longest_streak,
    daysLoggedLast7: row.days_logged_last_7,
    lastLogDate: row.last_log_date,
    createdAt: row.created_at,
  }
}

export function mapBehaviorAttributes(row: BehaviorAttributesRow): BehaviorAttributes {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    consistencyScore: row.consistency_score,
    stabilityScore: row.stability_score,
    momentumScore: row.momentum_score,
    disciplineScore: row.discipline_score,
    calculationVersion: row.calculation_version,
    calculatedAt: row.calculated_at,
    createdAt: row.created_at,
  }
}

export function mapCreatureStats(row: CreatureStatsRow): CreatureStats {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    strength: row.strength,
    resilience: row.resilience,
    momentum: row.momentum,
    vitality: row.vitality,
    stage: row.stage,
    createdAt: row.created_at,
  }
}

export function mapDailyFeedback(row: DailyFeedbackRow): DailyFeedback {
  return {
    id: row.id,
    userId: row.user_id,
    logDate: row.log_date,
    dailyEvaluationId: row.daily_evaluation_id,
    status: row.status,
    message: row.message,
    recommendation: row.recommendation,
    createdAt: row.created_at,
  }
}

export function mapWeightEntry(row: WeightEntryRow): WeightEntry {
  return {
    id: row.id,
    userId: row.user_id,
    entryDate: row.entry_date,
    weightKg: row.weight_kg,
    sourceUnit: row.source_unit,
    sourceValue: row.source_value,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
