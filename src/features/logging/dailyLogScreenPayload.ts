import {
  mapBehaviorAttributes,
  mapCreatureStats,
  mapDailyEvaluation,
  mapDailyFeedback,
  mapDailyLog,
  mapHabitMetrics,
  mapMeal,
  mapMealItem,
} from '@/lib/domainMappers'
import type { DailyLog, HabitMetrics, Meal } from '@/types/domain'
import type { DailyLogRow, MealItemRow, MealRow } from '@/types/database'
import type { DailyLogDerivedData, LatestFallbackMetricsData } from './useDailyLog'
import { compareMealsForDailyLog } from './mealDailyLogOrder'
import type { RepeatLastMealPreview } from './useRepeatLastMealPreview'

export interface ProfileScreenSummary {
  timezone: string | null
  calorieTarget: number | null
  onboardingCompletedAt: string | null
}

export interface DailyLogScreenData {
  profile: ProfileScreenSummary
  dailyLog: DailyLog | null
  meals: Meal[]
  derived: DailyLogDerivedData
  latestFallback: LatestFallbackMetricsData
  repeatLastMeal: RepeatLastMealPreview | null
}

function mapProfile(
  row: { timezone: string | null; calorie_target: number | null; onboarding_completed_at: string | null } | null,
): ProfileScreenSummary {
  if (!row) {
    return { timezone: null, calorieTarget: null, onboardingCompletedAt: null }
  }
  return {
    timezone: row.timezone,
    calorieTarget: row.calorie_target,
    onboardingCompletedAt: row.onboarding_completed_at,
  }
}

export function mapDailyLogScreenPayload(raw: unknown): DailyLogScreenData {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid daily log screen payload')
  }
  const p = raw as Record<string, unknown>

  const prof = p.profile
  const profile = mapProfile(
    prof && typeof prof === 'object' && prof !== null
      ? (prof as { timezone: string | null; calorie_target: number | null; onboarding_completed_at: string | null })
      : null,
  )

  const logRow = p.daily_log
  const dailyLog =
    logRow && typeof logRow === 'object' && logRow !== null
      ? mapDailyLog(logRow as DailyLogRow)
      : null

  const mealsRaw = p.meals
  const mealPairs: { meal: MealRow; items: MealItemRow[] }[] = []
  if (Array.isArray(mealsRaw)) {
    for (const entry of mealsRaw) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as Record<string, unknown>
      const m = e.meal
      const items = e.items
      if (!m || typeof m !== 'object') continue
      const itemRows: MealItemRow[] = Array.isArray(items)
        ? (items.filter((x) => x && typeof x === 'object') as MealItemRow[])
        : []
      mealPairs.push({ meal: m as MealRow, items: itemRows })
    }
  }

  const meals = mealPairs
    .map(({ meal, items }) => mapMeal(meal, items.map((row) => mapMealItem(row))))
    .sort(compareMealsForDailyLog)

  const d = p.derived
  const derivedBlock =
    d && typeof d === 'object' && d !== null
      ? (d as Record<string, unknown>)
      : {}

  const evalRow = derivedBlock.daily_evaluation
  const habitRow = derivedBlock.habit_metrics
  const behRow = derivedBlock.behavior_attributes
  const cstatsRow = derivedBlock.creature_stats
  const feedRow = derivedBlock.daily_feedback

  const derived: DailyLogDerivedData = {
    evaluation: evalRow && typeof evalRow === 'object' ? mapDailyEvaluation(evalRow as never) : null,
    habitMetrics: habitRow && typeof habitRow === 'object' ? mapHabitMetrics(habitRow as never) : null,
    behaviorAttributes: behRow && typeof behRow === 'object' ? mapBehaviorAttributes(behRow as never) : null,
    creatureStats: cstatsRow && typeof cstatsRow === 'object' ? mapCreatureStats(cstatsRow as never) : null,
    feedback: feedRow && typeof feedRow === 'object' ? mapDailyFeedback(feedRow as never) : null,
  }

  const fb = p.latest_fallback
  const fbBlock =
    fb && typeof fb === 'object' && fb !== null
      ? (fb as Record<string, unknown>)
      : {}
  const latestHm = fbBlock.habit_metrics
  const latestCs = fbBlock.creature_stats

  const latestFallback: LatestFallbackMetricsData = {
    habitMetrics: latestHm && typeof latestHm === 'object' ? mapHabitMetrics(latestHm as never) : null,
    creatureStats: latestCs && typeof latestCs === 'object' ? mapCreatureStats(latestCs as never) : null,
  }

  const r = p.repeat_last_meal
  let repeatLastMeal: RepeatLastMealPreview | null = null
  if (r && typeof r === 'object' && r !== null) {
    const o = r as Record<string, unknown>
    repeatLastMeal = {
      mealName: (o.meal_name as string | null) ?? null,
      mealType: (o.meal_type as string | null) ?? null,
      totalCalories: typeof o.total_calories === 'number' ? o.total_calories : Number(o.total_calories) || 0,
    }
  }

  return { profile, dailyLog, meals, derived, latestFallback, repeatLastMeal }
}

/** Streak source from the screen RPC, including same-day derived data and latest fallback metrics. */
export function habitMetricsForStreak(
  dailyLog: DailyLog | null,
  derived: DailyLogDerivedData,
  latestFallback: LatestFallbackMetricsData,
): HabitMetrics | null {
  const needFallback =
    !derived.habitMetrics ||
    !derived.creatureStats ||
    !dailyLog?.isFinalized
  if (derived.habitMetrics) return derived.habitMetrics
  if (needFallback) return latestFallback.habitMetrics
  return null
}
