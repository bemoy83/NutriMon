import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapDailyLog, mapMeal } from '@/lib/domainMappers'
import { groupMealItemsByMealId } from './mealItemGroups'
import { DAILY_LOG_CORE_QUERY_KEY, type DailyLogCoreData } from './useDailyLog'

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

      return {
        dailyLog: mapDailyLog(logRow),
        meals: (mealRows ?? []).map((meal) => mapMeal(meal, itemsByMealId[meal.id] ?? [])),
      }
    },
  })
}
