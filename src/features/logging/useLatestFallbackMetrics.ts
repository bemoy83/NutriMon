import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapCreatureStats, mapHabitMetrics } from '@/lib/domainMappers'
import { LATEST_FALLBACK_METRICS_QUERY_KEY, type LatestFallbackMetricsData } from './useDailyLog'

export function useLatestFallbackMetrics(enabled = true) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [LATEST_FALLBACK_METRICS_QUERY_KEY, user?.id],
    enabled: !!user && enabled,
    queryFn: async (): Promise<LatestFallbackMetricsData> => {
      const uid = user!.id

      const [habitMetricsResult, creatureStatsResult] = await Promise.all([
        supabase
          .from('habit_metrics')
          .select('*')
          .eq('user_id', uid)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('creature_stats')
          .select('*')
          .eq('user_id', uid)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      return {
        habitMetrics: habitMetricsResult.data ? mapHabitMetrics(habitMetricsResult.data) : null,
        creatureStats: creatureStatsResult.data ? mapCreatureStats(creatureStatsResult.data) : null,
      }
    },
  })
}
