import { useQuery } from '@tanstack/react-query'
import { format, subDays } from 'date-fns'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapWeightEntry } from '@/lib/domainMappers'

export function useWeightEntries(days: 30 | 90) {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['weight-entries', user?.id, days],
    enabled: !!user,
    queryFn: async () => {
      const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user!.id)
        .gte('entry_date', since)
        .order('entry_date', { ascending: true })

      if (error) throw error
      return (data ?? []).map(mapWeightEntry)
    },
  })
}
