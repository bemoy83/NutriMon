import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import { queryKeys } from '@/lib/queryKeys'
import {
  CREATURE_COMPANION_SELECT,
  CREATURE_STATS_LATEST_SELECT,
  HABIT_METRICS_LATEST_SELECT,
} from '@/lib/supabaseSelect'
import { mapCreatureCompanion, mapCreatureStats, mapHabitMetrics } from '@/lib/domainMappers'
import type { CreatureCompanionRow, CreatureStatsRow, HabitMetricsRow } from '@/types/database'
import type { CreatureCompanion, CreatureStats, HabitMetrics } from '@/types/domain'

interface LatestCreatureStatsResult {
  companion: CreatureCompanion | null
  stats: CreatureStats | null
  metrics: HabitMetrics | null
}

export function useLatestCreatureStats() {
  const { user } = useAuth()

  return useQuery({
    queryKey: queryKeys.creature.statsLatest(user?.id),
    enabled: !!user,
    queryFn: async (): Promise<LatestCreatureStatsResult> => {
      const [companionRes, statsRes, metricsRes] = await Promise.all([
        supabase
          .from('creature_companions')
          .select(CREATURE_COMPANION_SELECT)
          .eq('user_id', user!.id)
          .maybeSingle(),
        supabase
          .from('creature_stats')
          .select(CREATURE_STATS_LATEST_SELECT)
          .eq('user_id', user!.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('habit_metrics')
          .select(HABIT_METRICS_LATEST_SELECT)
          .eq('user_id', user!.id)
          .order('log_date', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (companionRes.error) throw companionRes.error
      if (statsRes.error) throw statsRes.error
      if (metricsRes.error) throw metricsRes.error

      return {
        companion: companionRes.data
          ? mapCreatureCompanion(companionRes.data as unknown as CreatureCompanionRow)
          : null,
        stats: statsRes.data ? mapCreatureStats(statsRes.data as unknown as CreatureStatsRow) : null,
        metrics: metricsRes.data ? mapHabitMetrics(metricsRes.data as unknown as HabitMetricsRow) : null,
      }
    },
  })
}
