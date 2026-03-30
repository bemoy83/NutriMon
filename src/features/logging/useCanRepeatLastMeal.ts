import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'

export function useCanRepeatLastMeal(date: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['repeat-last-meal-available', user?.id, date],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('id')
        .eq('user_id', user!.id)
        .lt('log_date', date)
        .gt('meal_count', 0)
        .limit(1)

      if (error) throw error
      return (data ?? []).length > 0
    },
  })
}
