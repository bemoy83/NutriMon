import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/app/providers/auth'
import type { CreatureStats, HabitMetrics } from '@/types/domain'
import { QUALIFYING_STREAK_DAYS_FOR_ADULT } from '@/lib/constants'

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-white">{value}</span>
      </div>
      <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function useLatestCreatureStats() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['creature-stats', 'latest', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<{ stats: CreatureStats | null; metrics: HabitMetrics | null }> => {
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

      return {
        stats: statsRes.data
          ? {
              id: statsRes.data.id,
              userId: statsRes.data.user_id,
              logDate: statsRes.data.log_date,
              strength: statsRes.data.strength,
              resilience: statsRes.data.resilience,
              momentum: statsRes.data.momentum,
              vitality: statsRes.data.vitality,
              stage: statsRes.data.stage,
              createdAt: statsRes.data.created_at,
            }
          : null,
        metrics: metricsRes.data
          ? {
              id: metricsRes.data.id,
              userId: metricsRes.data.user_id,
              logDate: metricsRes.data.log_date,
              currentStreak: metricsRes.data.current_streak,
              longestStreak: metricsRes.data.longest_streak,
              daysLoggedLast7: metricsRes.data.days_logged_last_7,
              lastLogDate: metricsRes.data.last_log_date,
              createdAt: metricsRes.data.created_at,
            }
          : null,
      }
    },
  })
}

export default function CreaturePage() {
  const { data, isLoading } = useLatestCreatureStats()
  const stats = data?.stats
  const metrics = data?.metrics
  const currentStreak = metrics?.currentStreak ?? 0
  const streakToEvolution = Math.max(0, QUALIFYING_STREAK_DAYS_FOR_ADULT - currentStreak)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-950">
        <div className="text-slate-400 text-sm">Loading…</div>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-slate-950 px-4 py-6 pb-24 flex flex-col items-center">
      <h1 className="text-xl font-bold text-white mb-6 self-start">Your Companion</h1>

      {/* Creature visual */}
      <div className="relative mb-6">
        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-indigo-900 to-slate-800 flex items-center justify-center shadow-2xl">
          <span className="text-7xl">🥚</span>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-slate-800 rounded-full px-2 py-0.5 border border-slate-700">
          <span className="text-xs text-slate-300 capitalize">{stats?.stage ?? 'baby'}</span>
        </div>
      </div>

      {/* Streak badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-orange-400 text-2xl font-bold">{currentStreak}</span>
        <div>
          <p className="text-white text-sm font-medium">day streak</p>
          <p className="text-slate-400 text-xs">
            Longest: {metrics?.longestStreak ?? 0} days
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="w-full max-w-sm space-y-4 bg-slate-800 rounded-xl p-5">
          <StatBar label="Strength" value={stats.strength} color="bg-red-500" />
          <StatBar label="Resilience" value={stats.resilience} color="bg-blue-500" />
          <StatBar label="Momentum" value={stats.momentum} color="bg-yellow-500" />
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-slate-300">Vitality</span>
              <span className="text-sm font-semibold text-white">{stats.vitality}</span>
            </div>
            <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${Math.min((stats.vitality / 200) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full max-w-sm bg-slate-800 rounded-xl p-5 text-center">
          <p className="text-slate-400 text-sm">
            Finalize your first day to see your creature's stats.
          </p>
        </div>
      )}

      {/* Evolution teaser */}
      <div className="w-full max-w-sm mt-4 bg-slate-800/50 rounded-xl p-4 border border-slate-700">
        <p className="text-slate-300 text-sm text-center">
          {streakToEvolution > 0
            ? `Next evolution in ${streakToEvolution} more qualifying day${streakToEvolution !== 1 ? 's' : ''}`
            : `Next evolution at ${QUALIFYING_STREAK_DAYS_FOR_ADULT}-day streak`}
        </p>
        {/* Progress toward evolution */}
        <div className="mt-2 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all"
            style={{
              width: `${Math.min((currentStreak / QUALIFYING_STREAK_DAYS_FOR_ADULT) * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
