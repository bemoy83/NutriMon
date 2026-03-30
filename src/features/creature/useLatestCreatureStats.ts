import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapCreatureStats, mapHabitMetrics } from '@/lib/domainMappers'
import type { CreatureStats, HabitMetrics } from '@/types/domain'

interface LatestCreatureStatsResult {
  stats: CreatureStats | null
  metrics: HabitMetrics | null
}

export function useLatestCreatureStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['creature-stats', 'latest', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LatestCreatureStatsResult> => {
      const [statsRes, metricsRes] = await Promise.all([
        supabase
          .from('creature_stats')
          .select('*')
          .eq('user_id', user!.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('habit_metrics')
          .select('*')
          .eq('user_id', user!.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (statsRes.error) throw statsRes.error
      if (metricsRes.error) throw metricsRes.error

      return {
        stats: statsRes.data ? mapCreatureStats(statsRes.data) : null,
        metrics: metricsRes.data ? mapHabitMetrics(metricsRes.data) : null,
      }
    },
  })
}
