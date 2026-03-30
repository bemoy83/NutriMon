import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { DailyEvaluation, HabitMetrics, BehaviorAttributes, CreatureStats, DailyFeedback, DailyLog, Meal } from '@/types/domain'
import {
  mapBehaviorAttributes,
  mapCreatureStats,
  mapDailyEvaluation,
  mapDailyFeedback,
  mapDailyLog,
  mapHabitMetrics,
  mapMeal,
} from '@/lib/domainMappers'
import { groupMealItemsByMealId } from './mealItemGroups'

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

      const dailyLog: DailyLog | null = logRow ? mapDailyLog(logRow) : null

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
          const itemsByMealId = groupMealItemsByMealId(itemRows)

          for (const m of mealRows) {
            meals.push(mapMeal(m, itemsByMealId[m.id] ?? []))
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
          fallbackHabitMetrics = mapHabitMetrics(fhm.data)
        }
        if (fcs.data) {
          fallbackCreatureStats = mapCreatureStats(fcs.data)
        }
      }

      return {
        dailyLog,
        meals,
        evaluation: evalRes.data ? mapDailyEvaluation(evalRes.data) : null,
        habitMetrics: hmRes.data ? mapHabitMetrics(hmRes.data) : null,
        behaviorAttributes: baRes.data ? mapBehaviorAttributes(baRes.data) : null,
        creatureStats: csRes.data ? mapCreatureStats(csRes.data) : null,
        feedback: fbRes.data ? mapDailyFeedback(fbRes.data) : null,
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
