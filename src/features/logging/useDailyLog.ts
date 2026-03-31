import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/app/providers/auth'
import type {
  BehaviorAttributes,
  CreatureStats,
  DailyEvaluation,
  DailyFeedback,
  DailyLog,
  HabitMetrics,
  Meal,
} from '@/types/domain'

export interface DailyLogCoreData {
  dailyLog: DailyLog | null
  meals: Meal[]
}

export interface DailyLogDerivedData {
  evaluation: DailyEvaluation | null
  habitMetrics: HabitMetrics | null
  behaviorAttributes: BehaviorAttributes | null
  creatureStats: CreatureStats | null
  feedback: DailyFeedback | null
}

export interface LatestFallbackMetricsData {
  habitMetrics: HabitMetrics | null
  creatureStats: CreatureStats | null
}

export const DAILY_LOG_CORE_QUERY_KEY = 'daily-log-core'
export const DAILY_LOG_DERIVED_QUERY_KEY = 'daily-log-derived'
export const LATEST_FALLBACK_METRICS_QUERY_KEY = 'latest-fallback-metrics'

export function useInvalidateDailyLog() {
  const qc = useQueryClient()
  const { user } = useAuth()

  return (date?: string) => {
    const coreQueryKey = date
      ? [DAILY_LOG_CORE_QUERY_KEY, user?.id, date]
      : [DAILY_LOG_CORE_QUERY_KEY, user?.id]
    const derivedQueryKey = date
      ? [DAILY_LOG_DERIVED_QUERY_KEY, user?.id, date]
      : [DAILY_LOG_DERIVED_QUERY_KEY, user?.id]

    qc.invalidateQueries({ queryKey: coreQueryKey })
    qc.invalidateQueries({ queryKey: derivedQueryKey })
    qc.invalidateQueries({ queryKey: [LATEST_FALLBACK_METRICS_QUERY_KEY, user?.id] })
  }
}
