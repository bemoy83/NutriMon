import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import { supabase } from '@/lib/supabase'
import {
  mapBehaviorAttributes,
  mapCreatureStats,
  mapDailyEvaluation,
  mapDailyFeedback,
  mapHabitMetrics,
} from '@/lib/domainMappers'
import { DAILY_LOG_DERIVED_QUERY_KEY, type DailyLogDerivedData } from './useDailyLog'

export function useDailyLogDerived(date: string) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [DAILY_LOG_DERIVED_QUERY_KEY, user?.id, date],
    enabled: !!user,
    queryFn: async (): Promise<DailyLogDerivedData> => {
      const uid = user!.id

      const [evaluationResult, habitMetricsResult, behaviorAttributesResult, creatureStatsResult, feedbackResult] =
        await Promise.all([
          supabase.from('daily_evaluations').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
          supabase.from('habit_metrics').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
          supabase.from('behavior_attributes').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
          supabase.from('creature_stats').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
          supabase.from('daily_feedback').select('*').eq('user_id', uid).eq('log_date', date).maybeSingle(),
        ])

      return {
        evaluation: evaluationResult.data ? mapDailyEvaluation(evaluationResult.data) : null,
        habitMetrics: habitMetricsResult.data ? mapHabitMetrics(habitMetricsResult.data) : null,
        behaviorAttributes: behaviorAttributesResult.data ? mapBehaviorAttributes(behaviorAttributesResult.data) : null,
        creatureStats: creatureStatsResult.data ? mapCreatureStats(creatureStatsResult.data) : null,
        feedback: feedbackResult.data ? mapDailyFeedback(feedbackResult.data) : null,
      }
    },
  })
}
