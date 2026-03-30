import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'

interface ProfileSummary {
  timezone: string | null
  calorieTarget: number | null
}

export function useProfileSummary() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['profile', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<ProfileSummary> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('timezone, calorie_target')
        .eq('user_id', user!.id)
        .single()

      if (error) throw error

      return {
        timezone: data.timezone,
        calorieTarget: data.calorie_target,
      }
    },
  })
}
