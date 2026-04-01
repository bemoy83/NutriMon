import type {
  BehaviorAttributes,
  BattleArena,
  BattleHub,
  BattleOpponent,
  BattleRecommendation,
  BattleRun,
  CreatureBattleSnapshot,
  CreatureCompanion,
  CreaturePreview,
  CreatureStats,
  DailyEvaluation,
  DailyFeedback,
  DailyLog,
  FoodSource,
  HabitMetrics,
  Meal,
  MealItem,
  MealTemplate,
  MealTemplateItem,
  Product,
  Profile,
  WeightEntry,
} from '@/types/domain'
import type {
  BehaviorAttributesRow,
  BattleArenaRow,
  BattleHubRow,
  BattleOpponentRow,
  BattleRecommendationRow,
  BattleRunRow,
  BattleRunWithOpponentRow,
  CreatureBattleSnapshotRow,
  CreatureCompanionRow,
  CreaturePreviewRow,
  CreatureStatsRow,
  DailyEvaluationRow,
  DailyFeedbackRow,
  DailyLogRow,
  FoodSourceRow,
  HabitMetricsRow,
  MealItemRow,
  MealRow,
  MealTemplateItemRow,
  MealTemplateWithItemsRow,
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
    mealName: row.meal_name ?? null,
    totalCalories: row.total_calories,
    itemCount: row.item_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  }
}

export function mapMealTemplateItem(row: MealTemplateItemRow): MealTemplateItem {
  return {
    id: row.id,
    templateId: row.template_id,
    productId: row.product_id,
    catalogItemId: row.catalog_item_id,
    quantity: row.quantity,
    nameSnapshot: row.name_snapshot,
    caloriesSnapshot: row.calories_snapshot,
    servingAmountSnapshot: row.serving_amount_snapshot,
    servingUnitSnapshot: row.serving_unit_snapshot,
    createdAt: row.created_at,
  }
}

export function mapMealTemplate(row: MealTemplateWithItemsRow): MealTemplate {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    defaultMealType: row.default_meal_type,
    useCount: row.use_count,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items: (row.items ?? []).map(mapMealTemplateItem),
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

export function mapCreatureCompanion(row: CreatureCompanionRow): CreatureCompanion {
  return {
    userId: row.user_id,
    name: row.name,
    stage: row.stage,
    level: row.level,
    xp: row.xp,
    currentCondition: row.current_condition,
    hatchedAt: row.hatched_at,
    evolvedToAdultAt: row.evolved_to_adult_at,
    evolvedToChampionAt: row.evolved_to_champion_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function mapCreatureBattleSnapshot(row: CreatureBattleSnapshotRow): CreatureBattleSnapshot {
  return {
    id: row.id,
    userId: row.user_id,
    prepDate: row.prep_date,
    battleDate: row.battle_date,
    strength: row.strength,
    resilience: row.resilience,
    momentum: row.momentum,
    vitality: row.vitality,
    readinessScore: row.readiness_score,
    readinessBand: row.readiness_band,
    condition: row.condition,
    level: row.level,
    stage: row.stage,
    sourceDailyEvaluationId: row.source_daily_evaluation_id,
    xpGained: row.xp_gained,
    createdAt: row.created_at,
  }
}

export function mapCreaturePreview(row: CreaturePreviewRow): CreaturePreview {
  return {
    tomorrowReadinessScore: row.tomorrow_readiness_score,
    tomorrowReadinessBand: row.tomorrow_readiness_band,
    projectedStrength: row.projected_strength,
    projectedResilience: row.projected_resilience,
    projectedMomentum: row.projected_momentum,
    projectedVitality: row.projected_vitality,
    mealRating: row.meal_rating,
    mealFeedbackMessage: row.meal_feedback_message,
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

export function mapBattleRecommendation(row: BattleRecommendationRow): BattleRecommendation {
  return {
    opponentId: row.opponent_id,
    name: row.name,
    archetype: row.archetype,
    recommendedLevel: row.recommended_level,
    likelyOutcome: row.likely_outcome,
  }
}

export function mapBattleArena(row: BattleArenaRow): BattleArena {
  return {
    id: row.id,
    arenaKey: row.arena_key,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function mapBattleOpponent(row: BattleOpponentRow): BattleOpponent {
  return {
    id: row.id,
    arenaId: row.arena_id,
    name: row.name,
    archetype: row.archetype,
    recommendedLevel: row.recommended_level,
    strength: row.strength,
    resilience: row.resilience,
    momentum: row.momentum,
    vitality: row.vitality,
    sortOrder: row.sort_order,
    unlockLevel: row.unlock_level,
    isActive: row.is_active,
    createdAt: row.created_at,
  }
}

export function mapBattleRun(row: BattleRunRow): BattleRun {
  return {
    id: row.id,
    userId: row.user_id,
    battleDate: row.battle_date,
    snapshotId: row.snapshot_id,
    opponentId: row.opponent_id,
    outcome: row.outcome,
    turnCount: row.turn_count,
    remainingHpPct: row.remaining_hp_pct,
    xpAwarded: row.xp_awarded,
    arenaProgressAwarded: row.arena_progress_awarded,
    rewardClaimed: row.reward_claimed,
    createdAt: row.created_at,
  }
}

export function mapBattleRunWithOpponent(row: BattleRunWithOpponentRow): BattleRun {
  return {
    ...mapBattleRun(row),
    opponent: row.opponent ? mapBattleOpponent(row.opponent) : null,
  }
}

export function mapBattleHub(row: BattleHubRow): BattleHub {
  return {
    companion: row.companion ? mapCreatureCompanion(row.companion) : null,
    snapshot: row.snapshot ? mapCreatureBattleSnapshot(row.snapshot) : null,
    recommendedOpponent: row.recommended_opponent ? mapBattleRecommendation(row.recommended_opponent) : null,
    unlockedOpponents: (row.unlocked_opponents ?? []).map(mapBattleOpponent),
    battleHistory: (row.battle_history ?? []).map(mapBattleRunWithOpponent),
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
