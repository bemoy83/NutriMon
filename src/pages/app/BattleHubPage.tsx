import { useNavigate } from 'react-router-dom'
import { ArenaCard } from '@/components/battle/ArenaCard'
import LoadingState from '@/components/ui/LoadingState'
import { useArenaList } from '@/features/battle/useArenaList'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { getTodayInTimezone } from '@/lib/date'
import type { CreatureCondition } from '@/types/domain'

function getConditionTone(condition: CreatureCondition) {
  switch (condition) {
    case 'thriving':
      return 'text-[var(--app-success)]'
    case 'recovering':
      return 'text-[var(--app-warning)]'
    default:
      return 'text-[var(--app-brand)]'
  }
}

export default function BattleHubPage() {
  const navigate = useNavigate()
  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const battleDate = getTodayInTimezone(timezone)
  const arenaListQuery = useArenaList(battleDate, timezone)

  const companion = arenaListQuery.data?.companion ?? null
  const snapshot = arenaListQuery.data?.snapshot ?? null
  const arenas = arenaListQuery.data?.arenas ?? []

  if (profileQuery.isLoading) return <LoadingState fullScreen />

  return (
    <div className="app-page min-h-full px-4 py-6 pb-24">
      <h1 className="mb-6 text-xl font-bold text-[var(--app-text-primary)]">Battle Hub</h1>

      {/* Compact creature + readiness card */}
      {companion ? (
        <div className="app-card mb-4 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--app-text-primary)]">
                {companion.name}
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <span className="text-xs capitalize text-[var(--app-text-muted)]">
                  Lv{companion.level} {companion.stage}
                </span>
                <span
                  className={`text-xs font-medium capitalize ${getConditionTone(companion.currentCondition)}`}
                >
                  {companion.currentCondition}
                </span>
              </div>
            </div>
            {snapshot ? (
              <div className="flex-shrink-0 text-right">
                <div className="rounded-full bg-[var(--app-brand-soft)] px-3 py-1 text-sm font-semibold text-[var(--app-brand)]">
                  {snapshot.readinessScore}/100
                </div>
                <p className="mt-1 text-xs capitalize text-[var(--app-text-muted)]">
                  {snapshot.readinessBand}
                </p>
              </div>
            ) : (
              <p className="flex-shrink-0 text-xs text-[var(--app-text-muted)]">No battle prep</p>
            )}
          </div>
        </div>
      ) : null}

      {/* Arena list */}
      {arenaListQuery.isLoading ? (
        <LoadingState label="Loading arenas…" />
      ) : arenaListQuery.error ? (
        <div className="app-card p-5">
          <p className="text-sm text-[var(--app-text-primary)]">Arena data unavailable right now.</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Try refreshing the page.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {arenas.map((arena) => (
            <ArenaCard
              key={arena.id}
              arena={arena}
              onClick={
                arena.isUnlocked
                  ? () => navigate(`/app/battle/arenas/${arena.id}`, { state: { arenaName: arena.name } })
                  : undefined
              }
            />
          ))}
          {arenas.length === 0 ? (
            <div className="app-card p-5">
              <p className="text-sm text-[var(--app-text-muted)]">No arenas available right now.</p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
