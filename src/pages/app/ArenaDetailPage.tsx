import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { OpponentCard } from '@/components/battle/OpponentCard'
import { ReadinessPanel } from '@/components/battle/ReadinessPanel'
import LoadingState from '@/components/ui/LoadingState'
import EmptyState from '@/components/ui/EmptyState'
import { useArenaDetail } from '@/features/battle/useArenaDetail'
import { useInvalidateBattleQueries } from '@/features/battle/useInvalidateBattleQueries'
import { startBattleRun } from '@/features/creature/api'
import { useProfileSummary } from '@/features/profile/useProfileSummary'
import { getTodayInTimezone } from '@/lib/date'
import { getArenaTerrain } from '@/lib/sprites'
import { deriveAccentVars } from '@/lib/arenaTheme'
import { useTerrainBackground } from '@/hooks/useTerrainBackground'
import type { BattleOpponent } from '@/types/domain'

export default function ArenaDetailPage() {
  const { arenaId } = useParams<{ arenaId: string }>()
  const navigate = useNavigate()

  const profileQuery = useProfileSummary()
  const timezone = profileQuery.data?.timezone ?? 'UTC'
  const battleDate = getTodayInTimezone(timezone)

  const location = useLocation()
  const arenaName = (location.state as { arenaName?: string } | null)?.arenaName ?? 'Arena'

  const arenaDetailQuery = useArenaDetail(arenaId ?? null, battleDate, timezone)
  const invalidateAll = useInvalidateBattleQueries()

  const [startingOpponentId, setStartingOpponentId] = useState<string | null>(null)
  const [battleActionError, setBattleActionError] = useState<string | null>(null)

  const data = arenaDetailQuery.data
  const snapshot = data?.snapshot ?? null
  const activeBattleRun = data?.activeBattleRun ?? null

  // Derive terrain background from the arena's player platform image
  const terrain = arenaId ? getArenaTerrain(arenaId) : null
  const terrainBg = useTerrainBackground(terrain?.playerPlatformUrl ?? null)
  // Derive full accent palette from the pre-baked arena accent color
  const accentVars = deriveAccentVars(terrain?.accentColor)

  // Override the fixed body::before background layer to match the arena gradient.
  // terrainBg resolves async; the effect re-runs whenever it settles.
  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--page-bg-image', terrainBg)
    root.style.setProperty('--page-bg-color', 'transparent')
    return () => {
      root.style.removeProperty('--page-bg-image')
      root.style.removeProperty('--page-bg-color')
    }
  }, [terrainBg])

  async function handleChallenge(opponent: BattleOpponent) {
    if (activeBattleRun?.opponentId === opponent.id) {
      navigate(`/app/battle/run/${activeBattleRun.id}`)
      return
    }

    if (!snapshot) return
    setStartingOpponentId(opponent.id)
    setBattleActionError(null)

    try {
      const session = await startBattleRun(snapshot.id, opponent.id)
      invalidateAll()
      navigate(`/app/battle/run/${session.id}`)
    } catch (error) {
      setBattleActionError(error instanceof Error ? error.message : 'Unable to start battle')
    } finally {
      setStartingOpponentId(null)
    }
  }

  if (profileQuery.isLoading || arenaDetailQuery.isLoading) {
    return <LoadingState fullScreen />
  }

  if (arenaDetailQuery.error || !data) {
    return (
      <div className="app-page min-h-full px-4 py-6 pb-24">
        <button
          type="button"
          onClick={() => navigate('/app/battle')}
          className="mb-4 flex items-center gap-1 text-sm text-[var(--app-text-secondary)]"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Battle Hub
        </button>
        <div className="app-card p-5">
          <p className="text-sm text-[var(--app-text-primary)]">Arena data unavailable right now.</p>
          <p className="mt-1 text-xs text-[var(--app-text-muted)]">Try refreshing the page.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="app-page min-h-screen pb-24"
      style={{ ...accentVars, background: terrainBg } as React.CSSProperties}
    >
      {/* Header scrim — dark-to-transparent overlay so white text stays legible
          over the lighter sky bands at the top of the terrain gradient */}
      <div
        className="px-4 pt-10 pb-6"
        style={{ background: 'linear-gradient(rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.32) 70%, transparent 100%)' }}
      >
        <button
          type="button"
          onClick={() => navigate('/app/battle')}
          className="mb-4 flex items-center gap-1 text-sm text-white/80"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Battle Hub
        </button>
        <h1 className="text-xl font-bold text-white drop-shadow">{arenaName}</h1>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Readiness */}
        {snapshot ? (
          <ReadinessPanel
            snapshot={snapshot}
            recommendedOpponent={data.recommendedOpponent}
            battleDate={battleDate}
          />
        ) : (
          <div className="app-card p-5">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
              Battle Readiness
            </p>
            <p className="mt-2 text-sm text-[var(--app-text-primary)]">
              No battle snapshot locked yet.
            </p>
            <p className="mt-1 text-xs text-[var(--app-text-muted)]">
              Finalize the previous day to prepare today&apos;s battle.
            </p>
          </div>
        )}

        {/* Opponent list */}
        <div className="app-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--app-border-muted)]">
            <p className="text-xs uppercase tracking-[0.12em] text-[var(--app-text-muted)]">
              Opponents
            </p>
            {battleActionError ? (
              <p className="mt-1 text-sm text-[var(--app-danger)]">{battleActionError}</p>
            ) : null}
          </div>
          <div>
            {data.arenaOpponents.length > 0 ? (
              data.arenaOpponents.map((opponent, index) => {
                const isActiveOpponent = activeBattleRun?.opponentId === opponent.id
                const hasOtherActive = !!activeBattleRun && !isActiveOpponent
                const isStarting = startingOpponentId === opponent.id
                const isDisabled =
                  !snapshot || isStarting || hasOtherActive || !opponent.isChallengeable

                return (
                  <Fragment key={opponent.id}>
                    {index > 0 && (
                      <div aria-hidden className="mx-4 h-px bg-[var(--app-border-muted)]" />
                    )}
                    <OpponentCard
                      opponent={opponent}
                      isActive={isActiveOpponent}
                      isStarting={isStarting}
                      isDisabled={isDisabled}
                      onChallenge={handleChallenge}
                    />
                  </Fragment>
                )
              })
            ) : (
              <EmptyState title="No opponents available in this arena yet." className="py-4" />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
