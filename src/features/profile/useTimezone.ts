import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { guessTimezone } from '@/lib/date'

export function useTimezone() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['profile-tz', user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('timezone')
        .eq('user_id', user!.id)
        .single()

      if (error) throw error
      return data?.timezone ?? guessTimezone()
    },
  })
}
