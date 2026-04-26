import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { getDefaultMealType, type MealType } from '@/lib/mealType'
import { DAILY_LOG_SCREEN_QUERY_KEY } from './useDailyLog'
import { mapDailyLogScreenPayload, type DailyLogScreenData } from './dailyLogScreenPayload'

/**
 * One RPC round-trip for the daily log screen: profile, core log + meals, derived + fallback, repeat preview.
 * `p_current_meal_type` is derived from "now" for repeat-meal CTA; included in the query key.
 */
export function useDailyLogScreen(logDate: string) {
  const { user } = useAuth()
  const currentMealType: MealType = getDefaultMealType(new Date().toISOString())

  return useQuery({
    queryKey: [DAILY_LOG_SCREEN_QUERY_KEY, user?.id, logDate, currentMealType],
    enabled: !!user,
    queryFn: async (): Promise<DailyLogScreenData> => {
      const { data, error } = await supabase.rpc('get_daily_log_screen_payload', {
        p_log_date: logDate,
        p_current_meal_type: currentMealType,
      })
      if (error) throw error
      return mapDailyLogScreenPayload(data)
    },
  })
}
