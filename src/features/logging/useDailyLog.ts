import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { DailyLog, Meal, MealItem, DailyEvaluation, HabitMetrics, BehaviorAttributes, CreatureStats, DailyFeedback } from '@/types/domain'

export interface DailyLogData {
  dailyLog: DailyLog | null
  meals: Meal[]
  evaluation: DailyEvaluation | null
  habitMetrics: HabitMetrics | null
  behaviorAttributes: BehaviorAttributes | null
  creatureStats: CreatureStats | null
  feedback: DailyFeedback | null
  fallbackHabitMetrics: HabitMetrics | null
  fallbackCreatureStats: CreatureStats | null
}

export function useDailyLog(date: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['daily-log', user?.id, date],
    enabled: !!user,
    queryFn: async (): Promise<DailyLogData> => {
      const uid = user!.id

      // Fetch daily log
      const { data: logRow } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', uid)
        .eq('log_date', date)
        .maybeSingle()

      const dailyLog: DailyLog | null = logRow
        ? {
            id: logRow.id,
            userId: logRow.user_id,
            logDate: logRow.log_date,
            totalCalories: logRow.total_calories,
            mealCount: logRow.meal_count,
            isFinalized: logRow.is_finalized,
            finalizedAt: logRow.finalized_at,
            createdAt: logRow.created_at,
            updatedAt: logRow.updated_at,
          }
        : null

      // Fetch meals with items
      const meals: Meal[] = []
      if (logRow) {
        const { data: mealRows } = await supabase
          .from('meals')
          .select('*')
          .eq('user_id', uid)
          .eq('daily_log_id', logRow.id)
          .order('logged_at', { ascending: false })

        if (mealRows) {
          const mealIds = mealRows.map((m) => m.id)
          const { data: itemRows } = mealIds.length > 0
            ? await supabase
                .from('meal_items')
                .select('*')
                .in('meal_id', mealIds)
            : { data: [] }

          for (const m of mealRows) {
            const items: MealItem[] = (itemRows ?? [])
              .filter((i) => i.meal_id === m.id)
              .map((i) => ({
                id: i.id,
                mealId: i.meal_id,
                productId: i.product_id,
                quantity: i.quantity,
                productNameSnapshot: i.product_name_snapshot,
                caloriesPerServingSnapshot: i.calories_per_serving_snapshot,
                proteinGSnapshot: i.protein_g_snapshot,
                carbsGSnapshot: i.carbs_g_snapshot,
                fatGSnapshot: i.fat_g_snapshot,
                servingAmountSnapshot: i.serving_amount_snapshot,
                servingUnitSnapshot: i.serving_unit_snapshot,
                lineTotalCalories: i.line_total_calories,
                createdAt: i.created_at,
              }))

            meals.push({
              id: m.id,
              userId: m.user_id,
              dailyLogId: m.daily_log_id,
              loggedAt: m.logged_at,
              totalCalories: m.total_calories,
              itemCount: m.item_count,
              createdAt: m.created_at,
              updatedAt: m.updated_at,
              items,
            })
          }
        }
      }

      // Fetch derived rows for this date
      const [evalRes, hmRes, baRes, csRes, fbRes] = await Promise.all([
        supabase.from('daily_evaluations').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
        supabase.from('habit_metrics').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
        supabase.from('behavior_attributes').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
        supabase.from('creature_stats').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
        supabase.from('daily_feedback').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
      ])

      const isFinalized = logRow?.is_finalized ?? false

      // Fallback widgets for unfinalized dates: latest finalized metrics overall
      let fallbackHabitMetrics: HabitMetrics | null = null
      let fallbackCreatureStats: CreatureStats | null = null

      if (!isFinalized || !hmRes.data) {
        const [fhm, fcs] = await Promise.all([
          supabase
            .from('habit_metrics')
            .select('*')
            .eq('user_id', uid)
            .order('log_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from('creature_stats')
            .select('*')
            .eq('user_id', uid)
            .order('log_date', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])
        if (fhm.data) {
          fallbackHabitMetrics = {
            id: fhm.data.id,
            userId: fhm.data.user_id,
            logDate: fhm.data.log_date,
            currentStreak: fhm.data.current_streak,
            longestStreak: fhm.data.longest_streak,
            daysLoggedLast7: fhm.data.days_logged_last_7,
            lastLogDate: fhm.data.last_log_date,
            createdAt: fhm.data.created_at,
          }
        }
        if (fcs.data) {
          fallbackCreatureStats = {
            id: fcs.data.id,
            userId: fcs.data.user_id,
            logDate: fcs.data.log_date,
            strength: fcs.data.strength,
            resilience: fcs.data.resilience,
            momentum: fcs.data.momentum,
            vitality: fcs.data.vitality,
            stage: fcs.data.stage,
            createdAt: fcs.data.created_at,
          }
        }
      }

      const toEval = (r: typeof evalRes.data): DailyEvaluation | null =>
        r
          ? {
              id: r.id,
              userId: r.user_id,
              dailyLogId: r.daily_log_id,
              logDate: r.log_date,
              targetCalories: r.target_calories,
              consumedCalories: r.consumed_calories,
              calorieDelta: r.calorie_delta,
              adherenceScore: r.adherence_score,
              adjustedAdherence: r.adjusted_adherence,
              status: r.status,
              calculationVersion: r.calculation_version,
              finalizedAt: r.finalized_at,
              createdAt: r.created_at,
            }
          : null

      const toHM = (r: typeof hmRes.data): HabitMetrics | null =>
        r
          ? {
              id: r.id,
              userId: r.user_id,
              logDate: r.log_date,
              currentStreak: r.current_streak,
              longestStreak: r.longest_streak,
              daysLoggedLast7: r.days_logged_last_7,
              lastLogDate: r.last_log_date,
              createdAt: r.created_at,
            }
          : null

      const toBA = (r: typeof baRes.data): BehaviorAttributes | null =>
        r
          ? {
              id: r.id,
              userId: r.user_id,
              logDate: r.log_date,
              consistencyScore: r.consistency_score,
              stabilityScore: r.stability_score,
              momentumScore: r.momentum_score,
              disciplineScore: r.discipline_score,
              calculationVersion: r.calculation_version,
              calculatedAt: r.calculated_at,
              createdAt: r.created_at,
            }
          : null

      const toCS = (r: typeof csRes.data): CreatureStats | null =>
        r
          ? {
              id: r.id,
              userId: r.user_id,
              logDate: r.log_date,
              strength: r.strength,
              resilience: r.resilience,
              momentum: r.momentum,
              vitality: r.vitality,
              stage: r.stage,
              createdAt: r.created_at,
            }
          : null

      const toFB = (r: typeof fbRes.data): DailyFeedback | null =>
        r
          ? {
              id: r.id,
              userId: r.user_id,
              logDate: r.log_date,
              dailyEvaluationId: r.daily_evaluation_id,
              status: r.status,
              message: r.message,
              recommendation: r.recommendation,
              createdAt: r.created_at,
            }
          : null

      return {
        dailyLog,
        meals,
        evaluation: toEval(evalRes.data),
        habitMetrics: toHM(hmRes.data),
        behaviorAttributes: toBA(baRes.data),
        creatureStats: toCS(csRes.data),
        feedback: toFB(fbRes.data),
        fallbackHabitMetrics,
        fallbackCreatureStats,
      }
    },
  })
}

export function useInvalidateDailyLog() {
  const qc = useQueryClient()
  const { user } = useAuth()
  return (date?: string) => {
    if (date) {
      qc.invalidateQueries({ queryKey: ['daily-log', user?.id, date] })
    } else {
      qc.invalidateQueries({ queryKey: ['daily-log', user?.id] })
    }
  }
}
