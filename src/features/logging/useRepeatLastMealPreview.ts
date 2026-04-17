import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'

export interface RepeatLastMealPreview {
  mealName: string | null
  mealType: string | null
  totalCalories: number
}

export const REPEAT_LAST_MEAL_PREVIEW_QUERY_KEY = 'repeat-last-meal-preview'

export function useRepeatLastMealPreview(logDate: string, mealType?: string | null) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [REPEAT_LAST_MEAL_PREVIEW_QUERY_KEY, user?.id, logDate, mealType ?? null],
    enabled: !!user,
    queryFn: async (): Promise<RepeatLastMealPreview | null> => {
      const uid = user!.id

      let query = supabase
        .from('meals')
        .select(
          `
          meal_name,
          meal_type,
          total_calories,
          daily_logs!inner ( log_date )
        `,
        )
        .eq('user_id', uid)
        .lt('daily_logs.log_date', logDate)

      if (mealType) {
        query = query.eq('meal_type', mealType)
      }

      const { data, error } = await query
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) throw error
      if (!data) return null

      const row = data as {
        meal_name: string | null
        meal_type: string | null
        total_calories: number | null
        daily_logs: { log_date: string }[]
      }

      return {
        mealName: row.meal_name,
        mealType: row.meal_type,
        totalCalories: row.total_calories ?? 0,
      }
    },
  })
}
