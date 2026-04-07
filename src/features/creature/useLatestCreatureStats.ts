import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { mapCreatureCompanion, mapCreatureStats, mapHabitMetrics } from '@/lib/domainMappers'
import type { CreatureCompanion, CreatureStats, HabitMetrics } from '@/types/domain'

interface LatestCreatureStatsResult {
  companion: CreatureCompanion | null
  stats: CreatureStats | null
  metrics: HabitMetrics | null
}

export function useLatestCreatureStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['creature-stats', 'latest', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<LatestCreatureStatsResult> => {
      const [companionRes, statsRes, metricsRes] = await Promise.all([
        supabase
          .from('creature_companions')
          .select('*')
          .eq('user_id', user!.id)
          .maybeSingle(),
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

      if (companionRes.error) throw companionRes.error
      if (statsRes.error) throw statsRes.error
      if (metricsRes.error) throw metricsRes.error

      return {
        companion: companionRes.data ? mapCreatureCompanion(companionRes.data) : null,
        stats: statsRes.data ? mapCreatureStats(statsRes.data) : null,
        metrics: metricsRes.data ? mapHabitMetrics(metricsRes.data) : null,
      }
    },
  })
}
