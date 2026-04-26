import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { WEIGHT_ENTRIES_LIST_SELECT } from '@/lib/supabaseSelect'
import { format, subDays } from 'date-fns'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import type { WeightEntryRow } from '@/types/database'
import { mapWeightEntry } from '@/lib/domainMappers'

export function useWeightEntries(days: 30 | 90) {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.weight.entries(user?.id, days),
    enabled: !!user,
    queryFn: async () => {
      const since = format(subDays(new Date(), days), 'yyyy-MM-dd')
      const { data, error } = await supabase
        .from('weight_entries')
        .select(WEIGHT_ENTRIES_LIST_SELECT)
        .eq('user_id', user!.id)
        .gte('entry_date', since)
        .order('entry_date', { ascending: true })

      if (error) throw error
      return ((data ?? []) as unknown as WeightEntryRow[]).map(mapWeightEntry)
    },
  })
}
