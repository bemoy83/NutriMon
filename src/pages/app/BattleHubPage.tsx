import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorldMapCanvas } from '@/components/battle/WorldMapCanvas'
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

const HUB_BG = '#0c1a10'

export default function BattleHubPage() {
  const navigate = useNavigate()

  // Override the fixed body::before background layer for the hub's dark forest theme.
  // Restored to defaults when navigating away.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--page-bg-color', HUB_BG)
    root.style.setProperty('--page-bg-image', 'none')
    return () => {
      root.style.removeProperty('--page-bg-color')
      root.style.removeProperty('--page-bg-image')
    }
  }, [])

  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const battleDate = getTodayInTimezone(timezone)
  const arenaListQuery = useArenaList(battleDate, timezone)

  const companion = arenaListQuery.data?.companion ?? null
  const snapshot = arenaListQuery.data?.snapshot ?? null
  const arenas = arenaListQuery.data?.arenas ?? []

  if (profileQuery.isLoading) return <LoadingState fullScreen />

  return (
    <div
      className="app-page min-h-screen px-4 py-6 pb-24"
      style={{ background: 'linear-gradient(165deg, #0c1a10 0%, #111c16 100%)' }}
    >
      <h1 className="mb-6 text-xl font-bold text-white">Battle Hub</h1>

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

      {/* World map */}
      {arenaListQuery.isLoading ? (
        <LoadingState label="Loading arenas…" />
      ) : arenaListQuery.error ? (
        <div className="app-card p-5">
          <p className="text-sm text-[var(--app-text-primary)]">Arena data unavailable right now.</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Try refreshing the page.</p>
        </div>
      ) : arenas.length === 0 ? (
        <div className="app-card p-5">
          <p className="text-sm text-[var(--app-text-muted)]">No arenas available right now.</p>
        </div>
      ) : (
        <WorldMapCanvas
          arenas={arenas}
          companion={companion}
          onSelectArena={(id, name) =>
            navigate(`/app/battle/arenas/${id}`, { state: { arenaName: name } })
          }
        />
      )}
    </div>
  )
}
