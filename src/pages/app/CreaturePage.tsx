import { QUALIFYING_STREAK_DAYS_FOR_ADULT } from '@/lib/constants'
import { useLatestCreatureStats } from '@/features/creature/useLatestCreatureStats'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'

function StatBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-sm text-[var(--app-text-secondary)]">{label}</span>
        <span className="text-sm font-semibold text-[var(--app-text-primary)]">{value}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden bg-[var(--app-border)]">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

export default function CreaturePage() {
  const { data, isLoading } = useLatestCreatureStats()
  const stats = data?.stats
  const metrics = data?.metrics
  const currentStreak = metrics?.currentStreak ?? 0
  const streakToEvolution = Math.max(0, QUALIFYING_STREAK_DAYS_FOR_ADULT - currentStreak)

  if (isLoading) {
    return <LoadingState fullScreen />
  }

  return (
    <div className="app-page flex min-h-full flex-col items-center px-4 py-6 pb-24">
      <h1 className="text-xl font-bold text-[var(--app-text-primary)] mb-6 self-start">Your Companion</h1>

      {/* Creature visual */}
      <div className="relative mb-6">
        <div className="w-40 h-40 rounded-full bg-gradient-to-br from-[var(--app-brand-soft)] to-[var(--app-surface-elevated)] flex items-center justify-center shadow-lg">
          <span className="text-7xl">🥚</span>
        </div>
        <div className="absolute -bottom-1 -right-1 rounded-full border border-[var(--app-border)] bg-[var(--app-surface)] px-2 py-0.5">
          <span className="text-xs text-[var(--app-text-secondary)] capitalize">{stats?.stage ?? 'baby'}</span>
        </div>
      </div>

      {/* Streak badge */}
      <div className="flex items-center gap-2 mb-6">
        <span className="text-[var(--app-warning)] text-2xl font-bold">{currentStreak}</span>
        <div>
          <p className="text-[var(--app-text-primary)] text-sm font-medium">day streak</p>
          <p className="text-[var(--app-text-muted)] text-xs">
            Longest: {metrics?.longestStreak ?? 0} days
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats ? (
        <div className="app-card w-full max-w-sm space-y-4 p-5">
          <StatBar label="Strength" value={stats.strength} color="bg-red-500" />
          <StatBar label="Resilience" value={stats.resilience} color="bg-blue-500" />
          <StatBar label="Momentum" value={stats.momentum} color="bg-yellow-500" />
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-sm text-[var(--app-text-secondary)]">Vitality</span>
              <span className="text-sm font-semibold text-[var(--app-text-primary)]">{stats.vitality}</span>
            </div>
            <div className="h-2.5 rounded-full overflow-hidden bg-[var(--app-border)]">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${Math.min((stats.vitality / 200) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="app-card w-full max-w-sm p-5">
          <EmptyState title="Finalize your first day to see your creature's stats." className="py-0" />
        </div>
      )}

      {/* Evolution teaser */}
      <div className="mt-4 w-full max-w-sm rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-muted)] p-4">
        <p className="text-[var(--app-text-secondary)] text-sm text-center">
          {streakToEvolution > 0
            ? `Next evolution in ${streakToEvolution} more qualifying day${streakToEvolution !== 1 ? 's' : ''}`
            : `Next evolution at ${QUALIFYING_STREAK_DAYS_FOR_ADULT}-day streak`}
        </p>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden bg-[var(--app-border)]">
          <div
            className="h-full rounded-full transition-all bg-[var(--app-brand)]"
            style={{
              width: `${Math.min((currentStreak / QUALIFYING_STREAK_DAYS_FOR_ADULT) * 100, 100)}%`,
            }}
          />
        </div>
      </div>
    </div>
  )
}
