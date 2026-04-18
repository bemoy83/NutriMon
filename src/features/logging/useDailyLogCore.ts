import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapDailyLog, mapMeal } from '@/lib/domainMappers'
import type { Meal } from '@/types/domain'
import { groupMealItemsByMealId } from './mealItemGroups'
import { DAILY_LOG_CORE_QUERY_KEY, type DailyLogCoreData } from './useDailyLog'

/** Standard diary slots first (Breakfast…Snack), then Other / null / custom types by logged_at. */
const STANDARD_SLOT_ORDER = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const

function mealDailyLogSortKey(meal: Meal): { tier: number; loggedAt: string; id: string } {
  const t = meal.mealType
  const idx = t ? (STANDARD_SLOT_ORDER as readonly string[]).indexOf(t) : -1
  if (idx >= 0) return { tier: idx, loggedAt: meal.loggedAt, id: meal.id }
  return { tier: STANDARD_SLOT_ORDER.length, loggedAt: meal.loggedAt, id: meal.id }
}

function compareMealsForDailyLog(a: Meal, b: Meal): number {
  const ka = mealDailyLogSortKey(a)
  const kb = mealDailyLogSortKey(b)
  if (ka.tier !== kb.tier) return ka.tier - kb.tier
  if (ka.loggedAt !== kb.loggedAt) return ka.loggedAt.localeCompare(kb.loggedAt)
  return ka.id.localeCompare(kb.id)
}

export function useDailyLogCore(date: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [DAILY_LOG_CORE_QUERY_KEY, user?.id, date],
    enabled: !!user,
    queryFn: async (): Promise<DailyLogCoreData> => {
      const uid = user!.id

      const { data: logRow } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', uid)
        .eq('log_date', date)
        .maybeSingle()

      if (!logRow) {
        return {
          dailyLog: null,
          meals: [],
        }
      }

      const { data: mealRows } = await supabase
        .from('meals')
        .select('*')
        .eq('user_id', uid)
        .eq('daily_log_id', logRow.id)
        .order('logged_at', { ascending: false })

      const mealIds = (mealRows ?? []).map((meal) => meal.id)
      const { data: itemRows } = mealIds.length > 0
        ? await supabase
            .from('meal_items')
            .select('*')
            .in('meal_id', mealIds)
        : { data: [] }
      const itemsByMealId = groupMealItemsByMealId(itemRows)

      const meals = (mealRows ?? [])
        .map((meal) => mapMeal(meal, itemsByMealId[meal.id] ?? []))
        .sort(compareMealsForDailyLog)

      return {
        dailyLog: mapDailyLog(logRow),
        meals,
      }
    },
  })
}
